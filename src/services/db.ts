import { neon } from '@neondatabase/serverless';

// Direct connection from the browser as requested
// WARNING: In a production app, you should use a backend to protect your credentials.
const DATABASE_URL = "postgresql://neondb_owner:npg_pXNvqtBU6z0M@ep-wispy-breeze-aizu3gjh-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require";

export const sql = neon(DATABASE_URL);

let isInitialized = false;

export async function initDatabase() {
  if (isInitialized) return;
  isInitialized = true;

  try {
    // Combine into a single block to reduce round-trips and potential race conditions
    await sql`
      DO $$ 
      BEGIN
        IF NOT EXISTS (SELECT FROM pg_tables WHERE tablename = 'exercises') THEN
          CREATE TABLE exercises (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            description TEXT NOT NULL,
            target_concept TEXT NOT NULL,
            solution_snippet TEXT NOT NULL,
            test_code TEXT NOT NULL,
            level INTEGER NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
          );
        END IF;

        IF NOT EXISTS (SELECT FROM pg_tables WHERE tablename = 'progress') THEN
          CREATE TABLE progress (
            id SERIAL PRIMARY KEY,
            exercise_id TEXT,
            user_code TEXT NOT NULL,
            is_correct BOOLEAN NOT NULL,
            feedback TEXT,
            completed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
          );
        END IF;

        IF NOT EXISTS (SELECT FROM pg_tables WHERE tablename = 'sessions') THEN
          CREATE TABLE sessions (
            id TEXT PRIMARY KEY,
            data JSONB NOT NULL,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
          );
        END IF;

        IF NOT EXISTS (SELECT FROM pg_tables WHERE tablename = 'saved_questions') THEN
          CREATE TABLE saved_questions (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            description TEXT NOT NULL,
            target_concept TEXT NOT NULL,
            solution_snippet TEXT NOT NULL,
            test_code TEXT NOT NULL,
            level INTEGER NOT NULL,
            saved_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
          );
        END IF;

        IF NOT EXISTS (SELECT FROM pg_tables WHERE tablename = 'saved_batches') THEN
          CREATE TABLE saved_batches (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            questions JSONB NOT NULL,
            saved_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
          );
        END IF;
      END $$;
    `;
    console.log("Neon Database Initialized directly from browser");
  } catch (error: any) {
    // If it's a concurrent DDL error, we can likely ignore it as the tables probably exist now
    if (error.message?.includes('pg_type_typname_nsp_index') || error.message?.includes('already exists')) {
      console.log("Database already initialized or concurrent initialization detected.");
    } else {
      console.error("Database initialization failed:", error);
      isInitialized = false; // Allow retry on real errors
    }
  }
}

export async function saveExercises(exercises: any[]) {
  try {
    for (const ex of exercises) {
      await sql`
        INSERT INTO exercises (id, title, description, target_concept, solution_snippet, test_code, level)
        VALUES (${ex.id}, ${ex.title}, ${ex.description}, ${ex.targetConcept}, ${ex.solutionSnippet}, ${ex.testCode}, ${ex.level})
        ON CONFLICT (id) DO NOTHING
      `;
    }
  } catch (error) {
    console.error("Error saving exercises:", error);
  }
}

export async function saveProgress(exerciseId: string, userCode: string, isCorrect: boolean, feedback: string) {
  try {
    await sql`
      INSERT INTO progress (exercise_id, user_code, is_correct, feedback)
      VALUES (${exerciseId}, ${userCode}, ${isCorrect}, ${feedback})
    `;
  } catch (error) {
    console.error("Error saving progress:", error);
  }
}

export async function getHistory() {
  try {
    const history = await sql`
      SELECT p.*, e.title, e.description, e.target_concept, e.solution_snippet, e.test_code, e.level
      FROM progress p
      LEFT JOIN exercises e ON p.exercise_id = e.id
      ORDER BY p.completed_at DESC
    `;
    return history;
  } catch (error) {
    console.error("Error fetching history:", error);
    return [];
  }
}

export async function saveSession(data: any) {
  try {
    if (data === null) {
      await sql`DELETE FROM sessions WHERE id = 'current_user_session'`;
      return;
    }
    const jsonData = JSON.stringify(data);
    await sql`
      INSERT INTO sessions (id, data, updated_at)
      VALUES ('current_user_session', ${jsonData}, CURRENT_TIMESTAMP)
      ON CONFLICT (id) DO UPDATE SET data = ${jsonData}, updated_at = CURRENT_TIMESTAMP
    `;
  } catch (error) {
    console.error("Error saving session:", error);
  }
}

export async function getSession() {
  try {
    const result = await sql`
      SELECT data FROM sessions WHERE id = 'current_user_session'
    `;
    return result[0]?.data || null;
  } catch (error) {
    console.error("Error fetching session:", error);
    return null;
  }
}

export async function saveSavedQuestion(ex: any) {
  try {
    await sql`
      INSERT INTO saved_questions (id, title, description, target_concept, solution_snippet, test_code, level)
      VALUES (${ex.id}, ${ex.title}, ${ex.description}, ${ex.targetConcept}, ${ex.solutionSnippet}, ${ex.testCode}, ${ex.level})
      ON CONFLICT (id) DO NOTHING
    `;
  } catch (error) {
    console.error("Error saving question:", error);
  }
}

export async function getSavedQuestions() {
  try {
    const result = await sql`
      SELECT * FROM saved_questions ORDER BY saved_at DESC
    `;
    return result;
  } catch (error) {
    console.error("Error fetching saved questions:", error);
    return [];
  }
}

export async function deleteSavedQuestion(id: string) {
  try {
    await sql`DELETE FROM saved_questions WHERE id = ${id}`;
  } catch (error) {
    console.error("Error deleting saved question:", error);
  }
}

export async function saveBatch(title: string, questions: any[]) {
  try {
    const id = crypto.randomUUID();
    const questionsJson = JSON.stringify(questions);
    await sql`
      INSERT INTO saved_batches (id, title, questions)
      VALUES (${id}, ${title}, ${questionsJson})
    `;
  } catch (error) {
    console.error("Error saving batch:", error);
  }
}

export async function getBatches() {
  try {
    const result = await sql`
      SELECT * FROM saved_batches ORDER BY saved_at DESC
    `;
    return result;
  } catch (error) {
    console.error("Error fetching batches:", error);
    return [];
  }
}

export async function deleteBatch(id: string) {
  try {
    await sql`DELETE FROM saved_batches WHERE id = ${id}`;
  } catch (error) {
    console.error("Error deleting batch:", error);
  }
}
