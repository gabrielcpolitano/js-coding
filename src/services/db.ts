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

        IF NOT EXISTS (SELECT FROM pg_tables WHERE tablename = 'daily_xp') THEN
          CREATE TABLE daily_xp (
            date DATE PRIMARY KEY,
            xp INTEGER DEFAULT 0
          );
          
          -- Initial migration from existing progress
          INSERT INTO daily_xp (date, xp)
          SELECT date_trunc('day', completed_at)::date as date, COUNT(*) as xp
          FROM progress
          WHERE is_correct = true
          GROUP BY date_trunc('day', completed_at)::date
          ON CONFLICT (date) DO UPDATE SET xp = EXCLUDED.xp;
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

    if (isCorrect) {
      await sql`
        INSERT INTO daily_xp (date, xp)
        VALUES (CURRENT_DATE, 1)
        ON CONFLICT (date) DO UPDATE SET xp = daily_xp.xp + 1
      `;
    }
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

export async function getXp() {
  try {
    const result = await sql`
      SELECT SUM(xp) as count FROM daily_xp
    `;
    return parseInt(result[0]?.count || "0");
  } catch (error) {
    console.error("Error fetching XP:", error);
    return 0;
  }
}

export async function getWeeklyXp() {
  try {
    const result = await sql`
      WITH days AS (
        SELECT generate_series(
          date_trunc('day', CURRENT_TIMESTAMP) - interval '6 days',
          date_trunc('day', CURRENT_TIMESTAMP),
          interval '1 day'
        )::date as day
      )
      SELECT 
        d.day,
        COALESCE(dx.xp, 0) as count
      FROM days d
      LEFT JOIN daily_xp dx ON dx.date = d.day
      ORDER BY d.day;
    `;
    return result.map(r => ({
      day: r.day,
      xp: parseInt(r.count)
    }));
  } catch (error) {
    console.error("Error fetching weekly XP:", error);
    return [];
  }
}

export async function getStreak() {
  try {
    const result = await sql`
      WITH daily_activity AS (
        SELECT date as activity_date
        FROM daily_xp
        WHERE xp > 0
      ),
      streak_groups AS (
        SELECT 
          activity_date,
          activity_date - (ROW_NUMBER() OVER (ORDER BY activity_date))::int as grp
        FROM daily_activity
      )
      SELECT COUNT(*) as streak
      FROM streak_groups
      WHERE grp = (
        SELECT grp 
        FROM streak_groups 
        WHERE activity_date = (SELECT MAX(activity_date) FROM daily_activity)
      )
      AND (SELECT MAX(activity_date) FROM daily_activity) >= CURRENT_DATE - interval '1 day';
    `;
    return parseInt(result[0]?.streak || "0");
  } catch (error) {
    console.error("Error fetching streak:", error);
    return 0;
  }
}
