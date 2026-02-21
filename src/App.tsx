/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Code2, 
  Copy, 
  Check, 
  Sparkles, 
  Terminal, 
  BookOpen, 
  Package, 
  ChevronRight,
  RefreshCw,
  Zap,
  History as HistoryIcon,
  PlayCircle,
  Bookmark,
  Trash2,
  Library
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { generateExercises, Exercise } from './services/geminiService';
import { initDatabase, saveExercises, saveProgress, getHistory, saveSession, getSession, saveSavedQuestion, getSavedQuestions, deleteSavedQuestion, saveBatch, getBatches, deleteBatch } from './services/db';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'training' | 'history' | 'saved'>('training');
  const [level, setLevel] = useState(1);
  const [topic, setTopic] = useState('');
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [savedBatches, setSavedBatches] = useState<any[]>([]);
  
  const [userCodes, setUserCodes] = useState<Record<string, string>>({});
  const [results, setResults] = useState<Record<string, { correct: boolean; feedback: string } | null>>({});
  const [isVerifying, setIsVerifying] = useState(false);
  const [showSolution, setShowSolution] = useState<Record<string, boolean>>({});

  const fetchHistory = async () => {
    try {
      const data = await getHistory();
      setHistory(data);
    } catch (err) {
      console.error("Failed to fetch history:", err);
    }
  };

  const fetchSavedBatches = async () => {
    try {
      const data = await getBatches();
      setSavedBatches(data);
    } catch (err) {
      console.error("Failed to fetch saved batches:", err);
    }
  };

  const fetchExercises = async () => {
    setLoading(true);
    setError(null);
    setExercises([]);
    setCurrentIndex(0);
    setUserCodes({});
    setResults({});
    setShowSolution({});
    
    // Clear session in DB
    await saveSession(null);
    
    try {
      const data = await generateExercises(level, topic);
      setExercises(data);
      
      // Save to DB directly from browser
      await saveExercises(data);
    } catch (err: any) {
      console.error(err);
      if (err.message?.includes("GEMINI_API_KEY")) {
        setError('API Key Missing: Please set your GEMINI_API_KEY environment variable to generate exercises.');
      } else {
        setError('Failed to generate exercises. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      await initDatabase();
      
      // Try to load session from DB
      const session = await getSession();
      if (session) {
        setExercises(session.exercises || []);
        setCurrentIndex(session.currentIndex || 0);
        setUserCodes(session.userCodes || {});
        setResults(session.results || {});
        setLevel(session.level || 1);
        setTopic(session.topic || '');
      } else {
        fetchExercises();
      }
      
      fetchHistory();
      fetchSavedBatches();
    };
    init();
  }, []);

  // Persist session to DB whenever relevant state changes
  useEffect(() => {
    if (exercises.length > 0) {
      const session = {
        exercises,
        currentIndex,
        userCodes,
        results,
        level,
        topic
      };
      saveSession(session);
    }
  }, [exercises, currentIndex, userCodes, results, level, topic]);

  const handleVerify = async (exercise: Exercise) => {
    const code = userCodes[exercise.id] || '';
    if (!code.trim()) return;

    setIsVerifying(true);
    
    let result: { correct: boolean; feedback: string };
    // Local Test Runner Implementation
    try {
      const runTest = new Function('expect', `
        try {
          ${code}
          ${exercise.testCode}
          return { correct: true, feedback: "All tests passed successfully!" };
        } catch (e) {
          return { correct: false, feedback: e.message };
        }
      `);

      const expect = (actual: any) => ({
        toBe: (expected: any) => {
          if (actual !== expected) {
            throw new Error(`Expected ${expected} but got ${actual}`);
          }
        },
        toEqual: (expected: any) => {
          const actualStr = JSON.stringify(actual);
          const expectedStr = JSON.stringify(expected);
          if (actualStr !== expectedStr) {
            throw new Error(`Expected ${expectedStr} but got ${actualStr}`);
          }
        },
        toBeTruthy: () => {
          if (!actual) throw new Error(`Expected truthy value but got ${actual}`);
        },
        toBeFalsy: () => {
          if (actual) throw new Error(`Expected falsy value but got ${actual}`);
        }
      });

      // Artificial delay to feel like a "test run"
      await new Promise(resolve => setTimeout(resolve, 600));
      
      result = runTest(expect);
      setResults(prev => ({ ...prev, [exercise.id]: result }));

      // Save progress to DB directly from browser
      await saveProgress(exercise.id, code, result.correct, result.feedback);
      fetchHistory(); // Refresh history
    } catch (err: any) {
      result = { correct: false, feedback: `Syntax Error: ${err.message}` };
      setResults(prev => ({ ...prev, [exercise.id]: result }));
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSaveBatch = async () => {
    if (exercises.length === 0) return;
    const title = `${topic || 'General'} - Level ${level} (${new Date().toLocaleDateString()})`;
    await saveBatch(title, exercises);
    fetchSavedBatches();
    alert("Batch of 10 exercises saved successfully!");
  };

  const handleDeleteBatch = async (id: string) => {
    if (window.confirm("Are you sure you want to delete this saved batch?")) {
      await deleteBatch(id);
      fetchSavedBatches();
    }
  };

  const handleRepeat = (item: any) => {
    const exercise: Exercise = {
      id: item.exercise_id,
      title: item.title,
      description: item.description,
      targetConcept: item.target_concept,
      solutionSnippet: item.solution_snippet,
      testCode: item.test_code,
      level: item.level
    };
    
    if (window.confirm(`Do you want to repeat the exercise: "${exercise.title}"?`)) {
      setExercises([exercise]);
      setCurrentIndex(0);
      setUserCodes({ [exercise.id]: item.user_code });
      setResults({});
      setShowSolution({});
      setActiveTab('training');
    }
  };

  const currentExercise = exercises[currentIndex];

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-100 font-sans selection:bg-emerald-500/30">
      {/* Header */}
      <header className="border-b border-zinc-800/50 bg-black/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center shadow-[0_0_20px_rgba(16,185,129,0.3)]">
              <Code2 className="text-black w-6 h-6" />
            </div>
            <div>
              <h1 className="font-bold text-lg tracking-tight">CodeMaster <span className="text-emerald-500">100</span></h1>
              <p className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold">10-Exercise Batch Mode</p>
            </div>
          </div>
          
          <div className="hidden md:flex items-center gap-4">
            <button 
              onClick={() => setActiveTab('training')}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium transition-all",
                activeTab === 'training' ? "bg-emerald-500/10 text-emerald-500" : "text-zinc-400 hover:text-zinc-200"
              )}
            >
              Training
            </button>
            <button 
              onClick={() => setActiveTab('history')}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2",
                activeTab === 'history' ? "bg-emerald-500/10 text-emerald-500" : "text-zinc-400 hover:text-zinc-200"
              )}
            >
              <HistoryIcon className="w-4 h-4" />
              History
            </button>
            <button 
              onClick={() => setActiveTab('saved')}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2",
                activeTab === 'saved' ? "bg-emerald-500/10 text-emerald-500" : "text-zinc-400 hover:text-zinc-200"
              )}
            >
              <Bookmark className="w-4 h-4" />
              Saved
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {activeTab === 'training' ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* ... Training UI ... */}
            <aside className="lg:col-span-3 space-y-6">
              <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 space-y-6">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-4 block">
                    Mastery Level: {level}
                  </label>
                  <input 
                    type="range" 
                    min="1" 
                    max="100" 
                    value={level}
                    onChange={(e) => setLevel(parseInt(e.target.value))}
                    className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                  />
                  <div className="flex justify-between mt-2 text-[10px] text-zinc-600 font-mono">
                    <span>BEGINNER</span>
                    <span>EXPERT</span>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2 block">
                    Topic (Optional)
                  </label>
                  <input 
                    type="text"
                    placeholder="e.g. Loops, Objects..."
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/50 transition-all"
                  />
                </div>

                <button 
                  onClick={fetchExercises}
                  disabled={loading}
                  className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:hover:bg-emerald-500 text-black font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                >
                  {loading ? (
                    <RefreshCw className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5" />
                      Generate 10 Exercises
                    </>
                  )}
                </button>
              </div>

              {exercises.length > 0 && (
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-4 space-y-2">
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 px-2 mb-2">Progress</h3>
                  <div className="space-y-1">
                    {exercises.map((ex, idx) => (
                      <button
                        key={ex.id}
                        onClick={() => setCurrentIndex(idx)}
                        className={cn(
                          "w-full text-left px-3 py-2 rounded-lg text-xs transition-all flex items-center justify-between group",
                          currentIndex === idx ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" : "text-zinc-500 hover:bg-zinc-800"
                        )}
                      >
                        <span className="truncate max-w-[140px]">{idx + 1}. {ex.title}</span>
                        {results[ex.id]?.correct && <Check className="w-3 h-3 text-emerald-500" />}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </aside>

            {/* Content Area */}
            <div className="lg:col-span-9 space-y-6">
              <AnimatePresence mode="wait">
                {loading ? (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="h-[600px] flex flex-col items-center justify-center space-y-4 bg-zinc-900/20 rounded-3xl border border-dashed border-zinc-800"
                  >
                    <div className="relative">
                      <div className="w-16 h-16 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin"></div>
                      <Sparkles className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-emerald-500 w-6 h-6" />
                    </div>
                    <p className="text-zinc-500 font-mono text-sm animate-pulse">Generating 10 Custom Exercises...</p>
                  </motion.div>
                ) : currentExercise ? (
                  <motion.div
                    key={currentExercise.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="space-y-6"
                  >
                    {/* Title & Meta */}
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 text-[10px] font-bold border border-emerald-500/20 uppercase tracking-widest">
                            Exercise {currentIndex + 1} of 10
                          </span>
                          <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 text-[10px] font-bold border border-zinc-700 uppercase tracking-widest">
                            Level {currentExercise.level}
                          </span>
                        </div>
                        <h2 className="text-3xl font-bold tracking-tight text-white">{currentExercise.title}</h2>
                      </div>
                      
                      <div className="flex gap-2">
                        <button 
                          onClick={handleSaveBatch}
                          className="p-2 bg-zinc-800 hover:bg-zinc-700 text-emerald-500 rounded-lg transition-colors flex items-center gap-2 text-xs font-bold px-3"
                          title="Save Entire Batch of 10"
                        >
                          <Library className="w-4 h-4" />
                          Save Batch
                        </button>
                        <button 
                          disabled={currentIndex === 0}
                          onClick={() => setCurrentIndex(prev => prev - 1)}
                          className="p-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 rounded-lg transition-colors"
                        >
                          <ChevronRight className="w-5 h-5 rotate-180" />
                        </button>
                        <button 
                          disabled={currentIndex === exercises.length - 1}
                          onClick={() => setCurrentIndex(prev => prev + 1)}
                          className="p-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 rounded-lg transition-colors"
                        >
                          <ChevronRight className="w-5 h-5" />
                        </button>
                      </div>
                    </div>

                    {/* Description */}
                    <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6">
                      <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                        <BookOpen className="w-4 h-4" />
                        Task Description
                      </h3>
                      <p className="text-zinc-300 leading-relaxed">
                        {currentExercise.description}
                      </p>
                      <div className="mt-4 pt-4 border-t border-zinc-800/50">
                        <span className="text-[10px] font-bold text-emerald-500/50 uppercase tracking-widest block mb-1">Target Concept</span>
                        <p className="text-xs text-zinc-500 italic">{currentExercise.targetConcept}</p>
                      </div>
                    </div>

                    {/* Code Editor */}
                    <div className="rounded-2xl overflow-hidden border border-zinc-800 bg-[#1e1e1e] shadow-2xl">
                      <div className="bg-zinc-900 px-4 py-2 border-b border-zinc-800 flex items-center justify-between">
                        <div className="flex gap-1.5">
                          <div className="w-3 h-3 rounded-full bg-red-500/50" />
                          <div className="w-3 h-3 rounded-full bg-amber-500/50" />
                          <div className="w-3 h-3 rounded-full bg-emerald-500/50" />
                        </div>
                        <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">editor.js</div>
                      </div>
                      <div className="p-4 space-y-4">
                        <textarea
                          value={userCodes[currentExercise.id] || ''}
                          onChange={(e) => setUserCodes(prev => ({ ...prev, [currentExercise.id]: e.target.value }))}
                          placeholder="// Implement your solution here..."
                          className="w-full h-64 bg-transparent text-zinc-300 font-mono text-sm focus:outline-none resize-none placeholder:text-zinc-700"
                        />
                        <div className="flex items-center justify-between pt-4 border-t border-zinc-800/50">
                          <button
                            onClick={() => handleVerify(currentExercise)}
                            disabled={isVerifying || !(userCodes[currentExercise.id]?.trim())}
                            className="px-6 py-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black font-bold rounded-lg text-sm transition-all flex items-center gap-2"
                          >
                            {isVerifying ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                            Test Code
                          </button>
                          <button
                            onClick={() => setShowSolution(prev => ({ ...prev, [currentExercise.id]: !prev[currentExercise.id] }))}
                            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                          >
                            {showSolution[currentExercise.id] ? 'Hide Reference' : 'Show Reference'}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Result & Solution */}
                    <AnimatePresence>
                      {results[currentExercise.id] && (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={cn(
                            "rounded-2xl p-6 border",
                            results[currentExercise.id]?.correct 
                              ? "bg-emerald-500/5 border-emerald-500/20" 
                              : "bg-red-500/5 border-red-500/20"
                          )}
                        >
                          <div className="flex items-start gap-4">
                            <div className={cn(
                              "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
                              results[currentExercise.id]?.correct ? "bg-emerald-500/20 text-emerald-500" : "bg-red-500/20 text-red-500"
                            )}>
                              {results[currentExercise.id]?.correct ? <Check className="w-6 h-6" /> : <Terminal className="w-6 h-6" />}
                            </div>
                            <div>
                              <h4 className={cn(
                                "font-bold text-sm",
                                results[currentExercise.id]?.correct ? "text-emerald-500" : "text-red-500"
                              )}>
                                {results[currentExercise.id]?.correct ? 'Test Passed!' : 'Test Failed'}
                              </h4>
                              <p className="text-sm text-zinc-400 mt-1">{results[currentExercise.id]?.feedback}</p>
                            </div>
                          </div>
                        </motion.div>
                      )}

                      {showSolution[currentExercise.id] && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          className="rounded-2xl overflow-hidden border border-zinc-800 bg-zinc-900/30"
                        >
                          <div className="bg-zinc-900 px-4 py-2 text-[10px] font-bold text-zinc-500 uppercase tracking-widest border-b border-zinc-800">
                            Reference Solution
                          </div>
                          <SyntaxHighlighter 
                            language="javascript" 
                            style={vscDarkPlus}
                            customStyle={{ margin: 0, padding: '1.5rem', background: 'transparent', fontSize: '13px' }}
                          >
                            {currentExercise.solutionSnippet}
                          </SyntaxHighlighter>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                ) : (
                  <div className="h-[600px] flex flex-col items-center justify-center text-zinc-600">
                    <Terminal className="w-12 h-12 mb-4 opacity-20" />
                    <p>Generate a batch of 10 exercises to start training</p>
                  </div>
                )}
              </AnimatePresence>
            </div>
          </div>
        ) : activeTab === 'history' ? (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                <HistoryIcon className="w-6 h-6 text-emerald-500" />
                Training History
              </h2>
              <p className="text-sm text-zinc-500">Your past attempts and progress</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {history.map((item) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 space-y-4 hover:border-emerald-500/30 transition-all group"
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Level {item.level}</span>
                      <h3 className="font-bold text-white group-hover:text-emerald-400 transition-colors">{item.title}</h3>
                    </div>
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center",
                      item.is_correct ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"
                    )}>
                      {item.is_correct ? <Check className="w-4 h-4" /> : <Terminal className="w-4 h-4" />}
                    </div>
                  </div>
                  
                  <p className="text-xs text-zinc-500 line-clamp-2">{item.description}</p>
                  
                  <div className="pt-4 border-t border-zinc-800 flex items-center justify-between">
                    <span className="text-[10px] text-zinc-600">{new Date(item.completed_at).toLocaleDateString()}</span>
                    <button 
                      onClick={() => handleRepeat(item)}
                      className="flex items-center gap-2 text-xs font-bold text-emerald-500 hover:text-emerald-400 transition-colors"
                    >
                      <PlayCircle className="w-4 h-4" />
                      Repeat
                    </button>
                  </div>
                </motion.div>
              ))}
              {history.length === 0 && (
                <div className="col-span-full h-64 flex flex-col items-center justify-center text-zinc-600 border border-dashed border-zinc-800 rounded-3xl">
                  <HistoryIcon className="w-12 h-12 mb-4 opacity-20" />
                  <p>No history yet. Complete some exercises first!</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                <Library className="w-6 h-6 text-emerald-500" />
                Saved Batches
              </h2>
              <p className="text-sm text-zinc-500">Your collection of 10-exercise training sets</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {savedBatches.map((batch) => (
                <motion.div
                  key={batch.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 space-y-4 hover:border-emerald-500/30 transition-all group"
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">10 Exercises</span>
                      <h3 className="font-bold text-white group-hover:text-emerald-400 transition-colors">{batch.title}</h3>
                    </div>
                    <button 
                      onClick={() => handleDeleteBatch(batch.id)}
                      className="w-8 h-8 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  
                  <p className="text-xs text-zinc-500">A complete set of exercises curated for your training.</p>
                  
                  <div className="pt-4 border-t border-zinc-800 flex items-center justify-between">
                    <span className="text-[10px] text-zinc-600">Saved on {new Date(batch.saved_at).toLocaleDateString()}</span>
                    <button 
                      onClick={() => {
                        setExercises(batch.questions);
                        setCurrentIndex(0);
                        setUserCodes({});
                        setResults({});
                        setShowSolution({});
                        setActiveTab('training');
                      }}
                      className="flex items-center gap-2 text-xs font-bold text-emerald-500 hover:text-emerald-400 transition-colors"
                    >
                      <PlayCircle className="w-4 h-4" />
                      Start Training
                    </button>
                  </div>
                </motion.div>
              ))}
              {savedBatches.length === 0 && (
                <div className="col-span-full h-64 flex flex-col items-center justify-center text-zinc-600 border border-dashed border-zinc-800 rounded-3xl">
                  <Library className="w-12 h-12 mb-4 opacity-20" />
                  <p>No saved batches yet. Save a set from the Training tab!</p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Error Toast */}
      <AnimatePresence>
        {error && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-red-500 text-white px-6 py-3 rounded-full shadow-2xl font-bold flex items-center gap-2 z-[100]"
          >
            <span>{error}</span>
            <button onClick={() => setError(null)} className="hover:opacity-70">✕</button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
