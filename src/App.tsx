/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Trophy, 
  RotateCcw, 
  Cpu, 
  User, 
  Zap,
  CheckCircle2,
  XCircle,
  Clock,
  Gift,
  Lightbulb,
  Settings,
  Music,
  AlertCircle
} from 'lucide-react';
import { generateQuestions, FALLBACK_QUESTIONS } from './services/questionGenerator';
import { playSound, playBackgroundSound, stopBackgroundSound, stopAllBackgroundSounds } from './services/soundEffects';
import SyriaFlag from './music/syria.svg';

// --- CONFIGURATION ---
const TOTAL_ROUNDS = 5;
const QUESTION_TIMER = 5000; // 5 seconds for question phase (matches max bot buzzer delay)
const DECISION_TIMER = 6000; // 6 seconds for decision phase
const COUNTDOWN_TIME = 3; // 3 second countdown before each question

interface Question {
  id: number;
  category: string;
  question: string;
  options: string[];
  correct: number;
  hint: string;
}

type GameState = 'INTRO' | 'COUNTDOWN' | 'WAITING_BUZZ' | 'DECISION' | 'ROUND_RESULT' | 'FINAL_RESULT';
type QuestionTopic = 'random' | 'general' | 'syrian-culture' | 'tech';

export default function App() {
  const [gameState, setGameState] = useState<GameState>('INTRO');
  const [selectedTopic, setSelectedTopic] = useState<QuestionTopic>('random');
  const [round, setRound] = useState(0);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [countdown, setCountdown] = useState(COUNTDOWN_TIME);
  
  const [playerScore, setPlayerScore] = useState(0);
  const [playerStreak, setPlayerStreak] = useState(0);
  const [playerAnswer, setPlayerAnswer] = useState<number | null>(null);
  const [isPlayerCorrect, setIsPlayerCorrect] = useState<boolean | null>(null);
  const [buzzedBy, setBuzzedBy] = useState<'PLAYER' | 'BOT' | null>(null);

  const [botScore, setBotScore] = useState(0);
  const [botStatus, setBotStatus] = useState<'Thinking...' | 'BUZZED!' | 'Waiting...' | 'Correct!' | 'Wrong!' | 'My Turn!' | ''>('');
  const [botAnswer, setBotAnswer] = useState<number | null>(null);
  const [isBotCorrect, setIsBotCorrect] = useState<boolean | null>(null);

  const timerStartRef = useRef<number>(0);
  const decisionTimerStartRef = useRef<number>(0);
  const [timeLeft, setTimeLeft] = useState(QUESTION_TIMER);
  const [decisionTimeLeft, setDecisionTimeLeft] = useState(DECISION_TIMER);
  const [crowdEnergy, setCrowdEnergy] = useState(50);
  const [hintVisible, setHintVisible] = useState(false);

  const [skipsAvailable, setSkipsAvailable] = useState(1);
  const [isSkipping, setIsSkipping] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [mutedSounds, setMutedSounds] = useState(false);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(false);
  const [questionsError, setQuestionsError] = useState<string | null>(null);

  const handleBuzzer = useCallback(() => {
    if (gameState !== 'WAITING_BUZZ' || buzzedBy !== null) return;
    setHintVisible(false);
    playSound('lock', mutedSounds);
    setBuzzedBy('PLAYER');
    setGameState('DECISION');
    decisionTimerStartRef.current = Date.now();
    setBotStatus('Waiting...');
  }, [gameState, buzzedBy]);

  const useHint = useCallback(() => {
    if (gameState !== 'DECISION' || buzzedBy !== 'PLAYER' || hintVisible) return;
    if (crowdEnergy < 15) {
      return;
    }
    setCrowdEnergy(e => Math.max(0, e - 15));
    setHintVisible(true);
    playSound('lock', mutedSounds);
  }, [gameState, buzzedBy, hintVisible, crowdEnergy, currentQuestion, mutedSounds]);

  const evaluateRound = useCallback(() => {
    setGameState('ROUND_RESULT');
  }, []);

  const triggerBotReply = useCallback(() => {
    setBotStatus('My Turn!');
    setTimeout(() => {
      setBotStatus('Correct!');
      playSound('correct', mutedSounds);
      setBotScore(s => s + 1);
      setTimeout(evaluateRound, 1500);
    }, 1000);
  }, [evaluateRound, mutedSounds]);

  const handlePlayerAnswer = useCallback((index: number) => {
    if (gameState !== 'DECISION' || buzzedBy !== 'PLAYER' || playerAnswer !== null) return;
    
    setPlayerAnswer(index);
    const correct = index === currentQuestion?.correct;
    setIsPlayerCorrect(correct);
    
    if (correct) {
      playSound('correct', mutedSounds);
      setPlayerStreak(s => s + 1);
      setCrowdEnergy(e => Math.min(100, e + 15));
      setPlayerScore(s => s + 1);
      setTimeout(evaluateRound, 1000);
    } else {
      playSound('wrong', mutedSounds);
      setPlayerStreak(0);
      setCrowdEnergy(e => Math.max(0, e - 10));
      triggerBotReply();
    }
  }, [gameState, buzzedBy, playerAnswer, currentQuestion, evaluateRound, triggerBotReply, mutedSounds]);

  const initGame = async () => {
    setIsLoadingQuestions(true);
    setQuestionsError(null);
    
    try {
      // Try to generate questions from Gemini API
      const generatedQuestions = await generateQuestions(TOTAL_ROUNDS + 1, selectedTopic); // Get 6 to allow for 1 skip
      const shuffled = generatedQuestions.sort(() => 0.5 - Math.random());
      setQuestions(shuffled);
      setRound(0);
      setPlayerScore(0);
      setBotScore(0);
      setPlayerStreak(0);
      setCrowdEnergy(50);
      setSkipsAvailable(1);
      setIsLoadingQuestions(false);
      startCountdown(0, shuffled);
    } catch (error) {
      console.error('Failed to generate questions:', error);
      // Fall back to hardcoded questions
      setQuestionsError('استخدام الأسئلة المعدة مسبقاً');
      const shuffled = [...FALLBACK_QUESTIONS].sort(() => 0.5 - Math.random()).slice(0, TOTAL_ROUNDS + 1);
      setQuestions(shuffled);
      setRound(0);
      setPlayerScore(0);
      setBotScore(0);
      setPlayerStreak(0);
      setCrowdEnergy(50);
      setSkipsAvailable(1);
      setIsLoadingQuestions(false);
      startCountdown(0, shuffled);
    }
  };

  const startCountdown = (roundIdx: number, qList: Question[]) => {
    setGameState('COUNTDOWN');
    setCountdown(COUNTDOWN_TIME);
    setRound(roundIdx + 1);
    setCurrentQuestion(qList[roundIdx]);
    setPlayerAnswer(null);
    setIsPlayerCorrect(null);
    setBuzzedBy(null);
    setHintVisible(false);
    setBotAnswer(null);
    setBotStatus('');
    setIsBotCorrect(null);
    setTimeLeft(QUESTION_TIMER);
    setDecisionTimeLeft(DECISION_TIMER);
  };

  useEffect(() => {
    let timer: any;
    if (gameState === 'COUNTDOWN') {
      if (countdown > 0) {
        playSound('tick', mutedSounds);
        timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      } else {
        setGameState('WAITING_BUZZ');
        timerStartRef.current = Date.now();
      }
    }
    return () => clearTimeout(timer);
  }, [gameState, countdown, mutedSounds]);

  useEffect(() => {
    if (gameState === 'WAITING_BUZZ' && buzzedBy === null) {
      // Periodic thinking sound
      const thinkingInterval = setInterval(() => {
        playSound('bot_thinking', mutedSounds);
      }, 800);

      const scoreDiff = botScore - playerScore;
      let minDelay = 3000;  // Adjusted for 5s question timer
      let maxDelay = 5000;  // Match QUESTION_TIMER

      if (playerScore > botScore) { minDelay = 2000; maxDelay = 4000; } 
      else if (scoreDiff >= 1) { minDelay = 3500; maxDelay = 5000; }

      if (round === TOTAL_ROUNDS && Math.abs(scoreDiff) <= 1) {
         minDelay = 2500; maxDelay = 4500;
      }
      
      const delay = Math.floor(Math.random() * (maxDelay - minDelay + 1) + minDelay);
      const botTimer = setTimeout(() => {
        if (buzzedBy === null && gameState === 'WAITING_BUZZ') {
          playSound('bot_buzz', mutedSounds);
          setBuzzedBy('BOT');
          setBotStatus('BUZZED!');
          setGameState('DECISION');
          decisionTimerStartRef.current = Date.now();
          
          setTimeout(() => {
            let accuracy = 0.85;
            if (scoreDiff >= 1.5) accuracy = 0.2; 

            const correct = Math.random() < accuracy;
            const answer = correct ? currentQuestion!.correct : (currentQuestion!.correct + 1) % 4;
            setBotAnswer(answer);
            setIsBotCorrect(correct);
            setBotStatus(correct ? 'Correct!' : 'Wrong!');
            
            if (correct) { 
              playSound('bot_correct', mutedSounds); 
              setBotScore(s => s + 1); 
            } else { 
              playSound('bot_wrong', mutedSounds);
              setPlayerScore(s => s + 0.5); 
            }
            setTimeout(evaluateRound, 1500);
          }, 1500);
        }
      }, delay);
      return () => {
        clearTimeout(botTimer);
        clearInterval(thinkingInterval);
      };
    }
  }, [gameState, currentQuestion, buzzedBy, playerStreak, evaluateRound, botScore, playerScore, round, mutedSounds]);

  useEffect(() => {
    let timer: any;
    if (gameState === 'WAITING_BUZZ') {
      // Initialize timer start when entering WAITING_BUZZ
      timerStartRef.current = Date.now();
      
      timer = setInterval(() => {
        const elapsed = Date.now() - timerStartRef.current;
        const remaining = Math.max(0, QUESTION_TIMER - elapsed);
        setTimeLeft(remaining);
        if (remaining <= 0) { 
          clearInterval(timer); 
          setBuzzedBy('BOT');
          triggerBotReply();
        }
      }, 50);
    } else if (gameState === 'DECISION') {
      timer = setInterval(() => {
        const elapsed = Date.now() - decisionTimerStartRef.current;
        const remaining = Math.max(0, DECISION_TIMER - elapsed);
        setDecisionTimeLeft(remaining);
        if (remaining <= 0) { 
          clearInterval(timer); 
          if (buzzedBy === 'PLAYER' && playerAnswer === null) {
            playSound('wrong', mutedSounds);
            triggerBotReply();
          }
        }
      }, 50);
    }
    return () => clearInterval(timer);
}, [gameState, buzzedBy, playerAnswer, triggerBotReply, mutedSounds]);

  const nextRound = () => {
    if (round < TOTAL_ROUNDS) startCountdown(round, questions);
    else setGameState('FINAL_RESULT');
  };

  const skipQuestion = useCallback(() => {
    if (skipsAvailable <= 0 || (gameState !== 'WAITING_BUZZ' && gameState !== 'DECISION')) return;
    
    setSkipsAvailable(0);
    setIsSkipping(true);
    playSound('lock', mutedSounds);
    
    const updatedQuestions = [...questions];
    updatedQuestions.splice(round - 1, 1);
    setQuestions(updatedQuestions);
    
    playSound('lock', mutedSounds);
    
    setTimeout(() => {
      setIsSkipping(false);
      startCountdown(round - 1, updatedQuestions);
    }, 1000);
  }, [skipsAvailable, gameState, questions, round, mutedSounds]);

  // Background sound effects management
  useEffect(() => {
    if (gameState === 'WAITING_BUZZ' && buzzedBy === null) {
      // Start atmospheric background for question phase
      playBackgroundSound('question_bg', 'bg_question', mutedSounds);
      return () => {
        stopBackgroundSound('question_bg');
      };
    }
  }, [gameState, buzzedBy, mutedSounds]);

  // Decision/Options phase background sound
  useEffect(() => {
    if (gameState === 'DECISION') {
      stopBackgroundSound('question_bg');
      // Start pulsing background for decision phase
      playBackgroundSound('decision_bg', 'bg_decision', mutedSounds);
      return () => {
        stopBackgroundSound('decision_bg');
      };
    }
  }, [gameState, mutedSounds]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopAllBackgroundSounds();
    };
  }, []);

  // Helper to get progress bar color based on time percentage
  const getProgressBarColor = (timeLeft: number, maxTime: number) => {
    const percentage = (timeLeft / maxTime) * 100;
    if (percentage > 60) return 'from-green-400 to-green-500';
    if (percentage > 20) return 'from-yellow-400 to-yellow-500';
    return 'from-red-500 to-red-600';
  };

  return (
    <div className="flex-1 flex flex-col min-h-screen overflow-y-auto select-none bg-mtn-navy" dir="rtl">
      
      {/* IMPROVED HEADER STATUS BAR */}
      <header className="h-[90px] md:h-[130px] bg-mtn-darker text-white flex flex-col p-2 md:p-4 shadow-2xl z-20 shrink-0 border-b-2 border-mtn-yellow/20 relative">
        <div className="flex justify-between items-center mb-1 md:mb-2 px-2 md:px-4">
         <div className="flex flex-col items-start min-w-[60px] md:min-w-[100px]">
           <span className="text-[10px] md:text-sm font-black text-mtn-yellow uppercase tracking-widest text-right w-full">انت</span>
           <span className="text-xl md:text-3xl font-black">{playerScore}</span>
         </div>
         <div className="flex flex-col items-center flex-1">
           <div className="flex items-center gap-2 md:gap-4 mb-1">
             <button onClick={() => setShowSettings(true)} className="p-2 hover:bg-white/10 rounded-full transition-colors order-first">
               <Settings size={20} className="text-mtn-yellow" />
             </button>
             <div className="text-sm md:text-xl font-black bg-mtn-yellow text-mtn-navy px-4 md:px-8 py-1 rounded-full shadow-lg">الجولة {round} من {TOTAL_ROUNDS}</div>
           </div>
           {/* CROWD ENERGY METER RE-INTEGRATED */}
           <div className="w-24 md:w-48 h-2 md:h-3 bg-white/10 rounded-full overflow-hidden border border-white/5">
             <motion.div animate={{ width: `${crowdEnergy}%` }} className="h-full bg-gradient-to-r from-red-500 via-mtn-yellow to-green-500 shadow-[0_0_10px_#FFCC00]" />
           </div>
         </div>
         <div className="flex flex-col items-end min-w-[60px] md:min-w-[100px]">
           <span className="text-[10px] md:text-sm font-black text-mtn-yellow uppercase tracking-widest text-left w-full">الروبوت</span>
           <span className="text-xl md:text-3xl font-black">{botScore}</span>
         </div>
        </div>
        <div className="flex-1 flex gap-2 w-full px-2 mt-1">
          <div className="flex-1 h-2 rounded-full bg-white/5 border border-white/10 overflow-hidden">
            <motion.div initial={{ width: 0 }} animate={{ width: `${(playerScore / TOTAL_ROUNDS) * 100}%` }} className="h-full bg-green-500 shadow-[0_0_15px_rgba(34,197,94,0.5)]" />
          </div>
          <div className="flex-1 h-2 rounded-full bg-white/5 border border-white/10 overflow-hidden flex justify-end">
            <motion.div initial={{ width: 0 }} animate={{ width: `${(botScore / TOTAL_ROUNDS) * 100}%` }} className="h-full bg-red-500 shadow-[0_0_15px_rgba(239,44,44,0.5)]" />
          </div>
        </div>
      </header>

      <div className="flex-1 flex flex-col relative w-full">
        <AnimatePresence mode="wait">
          
          {gameState === 'INTRO' && (
            <motion.div key="intro" className="min-h-[70vh] flex flex-col items-center justify-center text-center p-4 py-12">
              <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 20, ease: "linear" }} className="bg-mtn-yellow/10 p-20 rounded-full mb-8">
                <Cpu size={140} className="text-mtn-yellow" />
              </motion.div>
              <h1 className="text-4xl md:text-7xl font-black mb-4 text-white">اهزم الروبوت</h1>
              <p className="text-xl md:text-2xl mt-4 text-white/60 mb-12">مؤتمر سوريا للتقنية - MTN</p>
              
              {questionsError && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-yellow-500/20 border-2 border-yellow-500 rounded-2xl p-4 mb-6 max-w-md flex items-center gap-3 text-yellow-300"
                >
                  <AlertCircle size={24} className="flex-shrink-0" />
                  <span className="text-sm md:text-base font-bold">{questionsError}</span>
                </motion.div>
              )}

              {/* TOPIC SELECTION */}
              <motion.div 
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-12 w-full max-w-2xl"
              >
                <h2 className="text-2xl md:text-3xl font-black text-mtn-yellow mb-6">اختر موضوع الأسئلة</h2>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { id: 'general' as QuestionTopic, label: 'معلومات عامة', icon: '📚' },
                    { id: 'syrian-culture' as QuestionTopic, label: 'الثقافة السورية', icon: (
                      <img src={SyriaFlag} alt="سوريا" className="inline-block w-8 h-5 object-cover rounded-sm" />
                    ) },
                    { id: 'random' as QuestionTopic, label: 'عشوائي', icon: '🎲' },
                    { id: 'tech' as QuestionTopic, label: 'تكنولوجيا', icon: '💻' },
                  ].map((topic) => (
                    <motion.button
                      key={topic.id}
                      onClick={() => setSelectedTopic(topic.id)}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className={`p-4 md:p-6 rounded-2xl font-black text-sm md:text-lg transition-all border-2 ${
                        selectedTopic === topic.id
                          ? 'bg-mtn-yellow text-mtn-navy border-mtn-yellow shadow-[0_0_20px_rgba(255,204,0,0.5)]'
                          : 'bg-white/5 text-white border-white/20 hover:border-mtn-yellow/50'
                      }`}
                    >
                      <div className="text-2xl mb-2">{topic.icon}</div>
                      {topic.label}
                    </motion.button>
                  ))}
                </div>
              </motion.div>
              
              <button 
                onClick={initGame} 
                disabled={isLoadingQuestions}
                className="bg-mtn-yellow text-mtn-navy text-3xl md:text-5xl font-black px-12 md:px-24 py-6 rounded-full shadow-[0_15px_40px_rgba(255,204,0,0.3)] hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                {isLoadingQuestions ? 'جاري التحضير...' : 'ابدأ الان!'}
              </button>
            </motion.div>
          )}

          {gameState === 'COUNTDOWN' && (
            <motion.div key="countdown" className="min-h-[70vh] flex flex-col items-center justify-center">
              <motion.div key={countdown} initial={{ scale: 2, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-[150px] md:text-[300px] font-black text-mtn-yellow drop-shadow-[0_0_50px_rgba(255,204,0,0.5)]">
                {countdown}
              </motion.div>
            </motion.div>
          )}

          {(gameState === 'WAITING_BUZZ' || gameState === 'DECISION' || gameState === 'ROUND_RESULT') && (
            <div className="flex-1 flex flex-col md:flex-row w-full bg-mtn-navy">
              {/* PLAYER AREA */}
              <div className={`flex-1 p-4 md:p-8 flex flex-col relative transition-colors duration-700 ${buzzedBy === 'PLAYER' ? 'bg-mtn-yellow/5' : ''}`}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 md:w-12 md:h-12 bg-white/10 rounded-full flex items-center justify-center border border-white/20 relative overflow-hidden">
                    <motion.div 
                      animate={{ 
                        y: [0, -4, 0],
                        opacity: [0.5, 1, 0.5]
                      }}
                      transition={{ 
                        duration: 3, 
                        repeat: Infinity, 
                        ease: "easeInOut" 
                      }}
                    >
                      <User size={24} className="text-white/60" />
                    </motion.div>
                    <motion.div 
                      animate={{ 
                        scale: [1, 1.2, 1],
                        opacity: [0.2, 0.4, 0.2]
                      }}
                      transition={{ 
                        duration: 4, 
                        repeat: Infinity 
                      }}
                      className="absolute inset-0 bg-white/20 rounded-full"
                    />
                  </div>
                  <div className="text-xs font-black text-mtn-yellow uppercase tracking-[0.3em]">اللاعب البشري</div>
                </div>
                
                {/* QUESTION PREVIEW - ALWAYS VISIBLE FROM WAITING_BUZZ */}
                <div className="w-full mb-8">
                   <div className="bg-black/40 border-2 border-mtn-yellow/30 p-6 md:p-10 rounded-3xl relative overflow-hidden backdrop-blur-sm shadow-2xl">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-mtn-yellow/5 -rotate-45 translate-x-12 -translate-y-12" />
                      <h2 className="text-xl md:text-4xl font-black text-white relative z-10 leading-tight">{currentQuestion?.question}</h2>
                   </div>
                   
                   {/* PROGRESS BAR BELOW QUESTION - Shows for WAITING_BUZZ and DECISION states */}
                   {(gameState === 'WAITING_BUZZ' || gameState === 'DECISION') && (
                     <div className="mt-6">
                       <div className="w-full bg-white/5 h-4 rounded-full overflow-hidden border-2 border-white/10 shadow-lg">
                         <motion.div 
                           animate={{ 
                             width: `${gameState === 'WAITING_BUZZ' ? (timeLeft / QUESTION_TIMER) * 100 : (decisionTimeLeft / DECISION_TIMER) * 100}%`
                           }}
                           className={`h-full bg-gradient-to-r ${gameState === 'WAITING_BUZZ' ? getProgressBarColor(timeLeft, QUESTION_TIMER) : getProgressBarColor(decisionTimeLeft, DECISION_TIMER)} shadow-[0_0_20px_rgba(255,255,255,0.4)]`}
                         />
                       </div>
                       <div className="text-center mt-2 text-sm font-black text-white/70">
                         {gameState === 'WAITING_BUZZ' ? `${(timeLeft / 1000).toFixed(1)}s` : `${(decisionTimeLeft / 1000).toFixed(1)}s`}
                       </div>
                     </div>
                   )}
                </div>

                {gameState === 'WAITING_BUZZ' && (
                   <div className="flex-1 flex flex-col items-center justify-center gap-8">
                      <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.9 }} onClick={handleBuzzer} className="group relative">
                        <div className="absolute inset-0 bg-red-600 rounded-full blur-3xl opacity-30 group-hover:opacity-50 transition-opacity" />
                        <div className="w-48 h-48 md:w-72 md:h-72 bg-gradient-to-br from-red-500 to-red-700 rounded-full border-[10px] md:border-[15px] border-red-400 shadow-3xl flex flex-col items-center justify-center relative">
                           <Zap size={80} className="text-white mb-2" />
                           <span className="text-white font-black text-xl md:text-3xl">اضغط!</span>
                        </div>
                      </motion.button>
                      
                      {skipsAvailable > 0 && (
                        <motion.button 
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={skipQuestion}
                          className="flex items-center gap-3 bg-white/10 hover:bg-white/20 text-white px-8 py-3 rounded-2xl border border-white/20 shadow-xl"
                        >
                          <RotateCcw size={24} />
                          <span className="font-black text-lg">تخطي هذا السؤال</span>
                        </motion.button>
                      )}
                    </div>
                   )}


                {gameState === 'DECISION' && buzzedBy === 'PLAYER' && (
                  <div className="flex-1 flex flex-col">
                    <div className="flex items-center justify-between mb-8">
                       <div className="flex items-center gap-3 bg-red-600 px-6 py-2 rounded-full text-white font-black">
                         <Clock size={20} />
                         <span>{(decisionTimeLeft / 1000).toFixed(1)}s</span>
                       </div>
                       
                       {/* HINT BUTTON */}
                       {!hintVisible && !playerAnswer && (
                         <div className="flex gap-2">
                           <motion.button 
                             whileHover={{ scale: 1.05 }}
                             whileTap={{ scale: 0.95 }}
                             onClick={useHint}
                             className="flex items-center gap-2 bg-mtn-yellow text-mtn-navy px-4 md:px-6 py-2 rounded-full font-black shadow-lg text-sm md:text-base"
                           >
                             <Lightbulb size={20} />
                             <span>تلميح</span>
                           </motion.button>
                           
                           {skipsAvailable > 0 && (
                             <motion.button 
                               whileHover={{ scale: 1.05 }}
                               whileTap={{ scale: 0.95 }}
                               onClick={skipQuestion}
                               className="flex items-center gap-2 bg-white/10 text-white px-4 md:px-6 py-2 rounded-full font-black shadow-lg text-sm md:text-base border border-white/20"
                             >
                               <RotateCcw size={20} />
                               <span>تخطي</span>
                             </motion.button>
                           )}
                         </div>
                       )}

                       <div className="text-mtn-yellow font-black animate-pulse">اختر الإجابة بسرعة!</div>
                    </div>

                    {hintVisible && (
                      <motion.div 
                        initial={{ opacity: 0, y: -10 }} 
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-white/10 border-l-4 border-mtn-yellow p-4 mb-6 rounded-r-xl"
                      >
                        <div className="text-sm uppercase font-black text-mtn-yellow mb-1 tracking-widest">التلميح</div>
                        <div className="text-lg text-white font-arabic italic">"{currentQuestion?.hint}"</div>
                      </motion.div>
                    )}

                    <div className="grid grid-cols-2 gap-4 h-full">
                      {currentQuestion?.options.map((opt, idx) => (
                        <button key={idx} onClick={() => handlePlayerAnswer(idx)} disabled={playerAnswer !== null}
                          className={`p-6 md:p-8 rounded-3xl text-lg md:text-2xl font-black border-4 transition-all
                            ${playerAnswer === idx ? (isPlayerCorrect ? 'bg-green-600 border-green-300' : 'bg-red-600 border-red-300') : 'bg-white/5 border-white/10 hover:bg-white/10'}
                            ${playerAnswer !== null && playerAnswer !== idx ? 'opacity-20 scale-95' : ''}
                          `}>
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* BOT AREA */}
              <div className={`flex-1 p-4 md:p-8 flex flex-col items-center justify-center border-t-2 md:border-t-0 md:border-r-2 border-mtn-yellow/10 relative transition-colors duration-700 ${buzzedBy === 'BOT' ? 'bg-mtn-yellow/5' : 'bg-black/10'}`}>
                <div className="absolute top-4 right-4 text-[10px] font-black text-mtn-yellow uppercase tracking-widest flex items-center gap-2">
                   <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                   SYR-AIv2
                </div>
                
                <motion.div 
                  animate={{ 
                    y: [0, -10, 0],
                  }}
                  transition={{ 
                    duration: 4, 
                    repeat: Infinity, 
                    ease: "easeInOut" 
                  }}
                  className="relative mb-8"
                >
                  <div className={`w-[180px] h-[180px] md:w-[280px] md:h-[280px] rounded-3xl bg-mtn-navy border-4 md:border-8 transition-all duration-300 flex items-center justify-center shadow-2xl relative overflow-hidden ${botStatus === 'My Turn!' ? 'border-red-500 shadow-red-500/50 scale-105' : 'border-mtn-yellow'}`}>
                    {/* THINKING OVERLAY */}
                    {botStatus === 'Thinking...' && (
                      <>
                        <motion.div 
                          initial={{ top: '-10%' }}
                          animate={{ top: '110%' }}
                          transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                          className="absolute left-0 right-0 h-1 bg-mtn-yellow/40 shadow-[0_0_15px_#FFCC00] z-10"
                        />
                        <div className="absolute inset-0 grid grid-cols-6 grid-rows-6 opacity-20">
                          {[...Array(36)].map((_, i) => (
                            <motion.div 
                              key={i}
                              animate={{ opacity: [0.1, 1, 0.1] }}
                              transition={{ repeat: Infinity, duration: Math.random() * 2 + 1, delay: Math.random() * 2 }}
                              className="w-1 h-1 bg-mtn-yellow rounded-full m-auto"
                            />
                          ))}
                        </div>
                      </>
                    )}

                    <div className="flex gap-8 relative z-20">
                       <motion.div 
                         animate={
                           botStatus === 'My Turn!' ? { height: [4, 4] } : 
                           botStatus === 'Thinking...' ? { scale: [1, 1.3, 1], backgroundColor: ['#FFCC00', '#FFFFFF', '#FFCC00'] } :
                           { height: [40, 4, 40], scale: [1, 1.05, 1] }
                         } 
                         transition={{ repeat: Infinity, duration: botStatus === 'Thinking...' ? 0.3 : 2 }} 
                         className="w-10 h-10 md:w-16 md:h-16 bg-mtn-yellow rounded-full shadow-glow" 
                       />
                       <motion.div 
                         animate={
                           botStatus === 'My Turn!' ? { height: [4, 4] } : 
                           botStatus === 'Thinking...' ? { scale: [1, 1.3, 1], backgroundColor: ['#FFCC00', '#FFFFFF', '#FFCC00'] } :
                           { height: [40, 4, 40], scale: [1, 1.05, 1] }
                         } 
                         transition={{ repeat: Infinity, duration: botStatus === 'Thinking...' ? 0.3 : 2, delay: 0.1 }} 
                         className="w-10 h-10 md:w-16 md:h-16 bg-mtn-yellow rounded-full shadow-glow" 
                       />
                    </div>
                  </div>
                  {botStatus === 'My Turn!' && (
                    <div className="absolute -top-6 -right-6 bg-red-600 text-white font-black px-4 py-2 rounded-lg text-lg animate-bounce">!دوري أنا</div>
                  )}
                </motion.div>
                
                <div className="h-20 flex items-center">
                   <div className={`text-3xl md:text-5xl font-black text-center transition-all duration-500 ${botStatus === 'Thinking...' ? 'text-mtn-yellow/40 animate-pulse font-mono tracking-tighter' : 'text-white'}`}>
                     {botStatus === 'Thinking...' ? 'ANALYZING...' : botStatus}
                   </div>
                </div>
              </div>
            </div>
          )}

          {/* FINAL RESULT */}
          {gameState === 'FINAL_RESULT' && (
            <motion.div key="final" className="flex-1 flex flex-col items-center justify-center text-center p-4 py-12">
              <Trophy className="text-mtn-yellow mb-4 md:mb-6 w-16 h-16 md:w-32 md:h-32" />
              <h1 className="text-4xl md:text-7xl font-black mb-4 md:mb-6 text-white">المجموع النهائي</h1>
              
              <div className="flex flex-col md:flex-row gap-4 md:gap-8 mb-8 md:mb-12 w-full max-w-4xl justify-center items-stretch">
                <div className="flex-1 p-6 md:p-10 border-4 border-mtn-yellow rounded-3xl bg-black/40 shadow-2xl flex flex-col items-center justify-center">
                   <div className="text-mtn-yellow text-sm md:text-xl uppercase font-black mb-2">أنت</div>
                   <div className="text-4xl md:text-8xl font-black text-white">{playerScore}</div>
                </div>
                
                <div className="flex-1 p-6 md:p-10 border-4 border-mtn-yellow/30 rounded-3xl bg-black/20 flex flex-col items-center justify-center">
                   <div className="text-mtn-yellow/50 text-sm md:text-xl uppercase font-black mb-2">الروبوت</div>
                   <div className="text-4xl md:text-8xl font-black text-white/50">{botScore}</div>
                </div>
              </div>

              {/* PRIZE CARD */}
              <motion.div 
                initial={{ y: 50, opacity: 0 }} 
                animate={{ y: 0, opacity: 1 }} 
                transition={{ delay: 0.5 }}
                className="w-full max-w-2xl bg-gradient-to-br from-mtn-yellow to-mtn-yellow/80 p-8 rounded-[40px] shadow-[0_20px_50px_rgba(255,204,0,0.4)] text-mtn-navy mb-8 md:mb-12"
              >
                 <div className="flex items-center justify-center gap-4 mb-4">
                   <Gift size={40} className="text-mtn-navy" />
                   <h2 className="text-3xl md:text-5xl font-black">جائزتك هي:</h2>
                 </div>
                 <div className="text-4xl md:text-6xl font-black mb-6 animate-pulse">
                   {playerScore > botScore ? 'باقة إنترنت 10 غيغابايت مجانية!' : 'باقة إنترنت 3 غيغابايت مجانية!'}
                 </div>
                 <div className="bg-mtn-navy text-mtn-yellow py-3 px-8 rounded-2xl inline-block text-xl md:text-2xl font-black">
                   تفضل باستلام جائزتك من المنصة الآن!
                 </div>
              </motion.div>

              <button onClick={() => setGameState('INTRO')} className="bg-white text-mtn-navy text-2xl md:text-4xl font-black px-12 md:px-24 py-4 md:py-6 rounded-full shadow-2xl hover:scale-110 active:scale-95 transition-all flex items-center gap-4">
                <RotateCcw size={32} />
                <span>إعادة التحدي</span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {isSkipping && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-mtn-yellow flex flex-col items-center justify-center text-mtn-navy"
          >
             <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}>
               <RotateCcw size={120} />
             </motion.div>
             <h1 className="text-6xl font-black mt-8 uppercase italic tracking-tighter text-center">جارٍ تخطي السؤال...</h1>
          </motion.div>
        )}

        {gameState === 'ROUND_RESULT' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex p-4 overflow-y-auto">
             <div className="bg-mtn-navy p-8 md:p-20 rounded-[40px] md:rounded-[80px] border-4 md:border-8 border-mtn-yellow text-center shadow-2xl w-full max-w-4xl m-auto">
                <div className="mb-8 md:mb-12">
                   {(isPlayerCorrect || (buzzedBy === 'BOT' && isBotCorrect === false)) ? (
                     <div className="w-24 h-24 md:w-48 md:h-48 bg-green-500 rounded-full flex items-center justify-center mx-auto text-white shadow-xl">
                        <CheckCircle2 className="w-12 h-12 md:w-32 md:h-32" />
                     </div>
                   ) : (
                     <div className="w-24 h-24 md:w-48 md:h-48 bg-red-500 rounded-full flex items-center justify-center mx-auto text-white shadow-xl">
                        <XCircle className="w-12 h-12 md:w-32 md:h-32" />
                     </div>
                   )}
                </div>
                
                <h3 className="text-4xl md:text-8xl font-black mb-4 md:mb-6 text-white font-arabic">
                   {isPlayerCorrect ? 'صح!' : (buzzedBy === 'PLAYER' || timeLeft <= 0) ? 'فاتك الوقت!' : 'بوت الذكاء الصنعي'}
                </h3>
                
                <div className="bg-white/5 p-6 md:p-12 rounded-2xl md:rounded-3xl mb-8 md:mb-12 border border-white/10">
                   <div className="text-[10px] md:text-sm uppercase font-black opacity-30 mb-2 md:mb-4 tracking-widest">الإجابة الصحيحة</div>
                   <div className="text-2xl md:text-5xl text-mtn-yellow font-black leading-tight font-arabic">{currentQuestion?.options[currentQuestion?.correct]}</div>
                </div>

                <button onClick={nextRound} className="bg-mtn-yellow text-mtn-navy text-3xl md:text-5xl font-black px-12 md:px-24 py-5 md:py-8 rounded-full w-full hover:scale-105 active:scale-95 transition-transform">التالي</button>
             </div>
          </motion.div>
        )}

        {showSettings && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[110] bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
             <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} className="bg-mtn-navy p-8 md:p-12 rounded-[40px] border-4 border-mtn-yellow shadow-2xl w-full max-w-md">
                <div className="flex items-center justify-between mb-8">
                   <h2 className="text-3xl font-black text-white">الإعدادات</h2>
                   <Settings className="text-mtn-yellow" size={32} />
                </div>

                <div className="space-y-6 mb-10">
                   <div className="flex items-center justify-between bg-white/5 p-6 rounded-3xl border border-white/10">
                      <div className="flex items-center gap-4">
                        <div className="p-3 bg-mtn-yellow/10 rounded-2xl">
                           <Music className="text-mtn-yellow" size={24} />
                        </div>
                        <span className="text-xl font-bold text-white">المؤثرات الصوتية</span>
                      </div>
                      <button 
                        onClick={() => setMutedSounds(!mutedSounds)}
                        className={`w-16 h-8 rounded-full transition-colors relative ${mutedSounds ? 'bg-white/20' : 'bg-green-500'}`}
                      >
                         <motion.div 
                           animate={{ x: mutedSounds ? 4 : 36 }}
                           className="absolute top-1 w-6 h-6 bg-white rounded-full shadow-lg"
                         />
                      </button>
                   </div>
                </div>

                <button onClick={() => setShowSettings(false)} className="bg-mtn-yellow text-mtn-navy text-2xl font-black px-12 py-4 rounded-full w-full hover:scale-105 active:scale-95 transition-transform shadow-xl">إغلاق</button>
             </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
