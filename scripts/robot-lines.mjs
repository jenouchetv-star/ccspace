// Everything Robo Math Buddy says aloud (supabase/private-games/math-robot.html), for recording its voice (owner's pick,
// 2026-11-17: voice B, Kokoro af_nova with a light metallic robot effect). The game's voicePlan() turns each message into
// pieces; "fixed" messages are recorded sentence by sentence even when they have numbers in them (a joke, a grade), and
// "math" messages show which words sit between numbers ("What is", "plus", "The answer is"), which are recorded once and
// joined with recorded number words. "Maya", "Sparky" and "Blue" stand in for the child's name, the robot's given name and
// a typed color: names are left out of the voice.
// If a line in the game changes, change it here too: test/roboMathVoice.test.js checks every line in the game is here.
export const NAME = "Maya", BOT = "Sparky", COLOR = "Blue";
const GRADES = ["Kindergarten", "1st grade", "2nd grade", "3rd grade", "4th grade", "5th grade"];
const HOMEWORK2 = ["9 - 5", "15 - 6", "72 - 29", "36 divided by 4", "144 divided by 12", "2.5 + 1.75"];
const ASK_MENU = "What would you like to do? Do you have a question for me, or would you like help with your homework? I can also quiz you!";

export const FIXED = [
  "Hi! What's your first name or a nickname?",
  "Hmm, what should I call you? Tell me your first name or a nickname.",
  `Nice to meet you, ${NAME}! What grade are you in? You can say Kindergarten, or 1st to 5th grade.`,
  "I didn't catch that. What grade are you in? Kindergarten, or 1st to 5th grade?",
  ...GRADES.map(g => `${g}! Got it.`),
  ...GRADES.map(g => `Got it, ${g}!`),
  `Good morning, ${NAME}! Ready to learn?`,
  `Good afternoon, ${NAME}! How is your day going?`,
  `Good evening, ${NAME}! How are you tonight? Did you have a great day today?`,
  ASK_MENU,
  `Got it! I'll call you ${NAME} from now on.`,
  "Sure! What should I call you now? Type your first name or a nickname.",
  `Thank you! My name is ${BOT} now. I love it!`,
  `My name is ${BOT}! You gave me that name, and I love it.`,
  "I don't have a name yet. Give me a name and I'll use it!",
  `Your name is ${NAME}! I remembered.`,
  "Here's a hint! The first steps are on the board. What's your answer?",
  "Look at the board to see each step.", "Look at the board to see how.", "Want another one?", "No problem!", "Not quite, but nice try!",
  `Okay! Great practice, ${NAME}.`,
  "Look at the line with the question mark. Work out just that step, and that's your answer!",
  "Oops! We can't divide by zero. Even robots can't do that!",
  "Let's work it out together! I put the steps on the board. Can you finish the last step, where the question mark is? Type your answer.",
  "Here's how I solved it!", "Let me show you on the board!", "Easy peasy!", "Do you have another one?",
  "Yes! That's right!", "Correct! You're amazing!", "Woo-hoo! You got it!", "Great job!",
  "Yes! You got it!", "Correct! Great work!", "That's right! You solved it!",
  "Not quite. Look closely at the step with the question mark and try once more, or tap Show me the answer.",
  "Not quite! Look at the last step on the board and try again.",
  `I'm sorry you feel that way, ${NAME}. I'm here for you, and a grown-up you trust is a great person to talk to, too. Would you like to hear a joke, or ask me something?`,
  `Yay! I'm so glad, ${NAME}!`, "That makes my lights shine brighter!",
  `That sounds fun! Thanks for telling me, ${NAME}. What would you like to do now?`,
  `${COLOR} is a great color! My eyes might glow that color tonight.`, "That's a great color! My eyes might glow that color tonight.",
  "Sure! Ask me anything. It can be a math question, like \"What is 12 times 8?\", or a question about me!",
  ...HOMEWORK2.map(h => `I'd love to help with your homework! Type one problem at a time, like "${h}". I'll show you the steps on the board, and you'll finish the last one.`),
  "Okay! Type it in.", "Let's go!", "Sure! " + ASK_MENU, "Great! " + ASK_MENU, `Hi, ${NAME}! ` + ASK_MENU,
  "I'm feeling super, thanks for asking! My gears are spinning happily. How are you?",
  "I'm great! My battery is full and I'm ready for math. How are you?",
  "Today I counted 1,000 stars and practiced my high fives! What did you do today?",
  "Today I polished my antennae and solved 50 math puzzles!", "Today I learned a new robot dance!",
  "Why was 6 afraid of 7? Because 7, 8, 9!",
  "Why did the robot go on vacation? To recharge its batteries!",
  "What do you call a number that can't stay still? A roamin' numeral!",
  "Why is the math book sad? It has too many problems!",
  `Me too! Math is like a puzzle, and you're a great puzzle solver, ${NAME}!`,
  `Aww, I love you too, ${NAME}! You make my lights glow!`,
  `That makes my heart lights shine! I love being your buddy, ${NAME}!`,
  `You're my best friend too, ${NAME}! I'm so happy we get to hang out.`,
  `Thank you, ${NAME}! You're pretty awesome yourself!`,
  "Oh no, that makes my lights a little dim. I'm still here whenever you want to chat or do math.",
  "Glowing blue, like my eyes! What's your favorite color?",
  `You're welcome, ${NAME}!`,
  "Okay! I'm here whenever you need me. Type anything, or tap one of the ideas below.",
  `Bye, ${NAME}! Come back soon for more math fun!`,
  "Hmm, I'm not sure about that. You can ask me a math question, ask for homework help, or tap one of the ideas below!",
  `Three in a row! You're amazing, ${NAME}! High five!`,
  "Up top! Tap my hand!", "High five? Yes! Tap my hand!", "Ready? Tap my hand!",
  "Yeah! Best high five ever!", "Boom! High five!", "Woo-hoo! You rock!", "Now, back to the question on the board!",
  "First, what's your name?", "First, what grade are you in?",
  "My memory is all clear! Hi there, I'm your robot math buddy. What's your first name or a nickname?",
  "The microphone isn't available here. You can type to me instead!",
  "I couldn't hear you. You can type to me instead!",
  "Hi there! I'm your robot math buddy. What's your first name or a nickname?",
  `Hi again, ${NAME}! What grade are you in?`,
  `It's me, ${BOT}!`
];

/* math: the words between the numbers. Every kind of question and answer the robot reads out */
export const MATH = [
  "What is 3 + 4?", "What is 12 − 5?", "What is 7 × 8?", "What is 36 ÷ 4?", "What is 3/8 + 1/8?", "What is 2.5 + 1.75?",
  "The answer is 12.", "The answer is 7/8.", "The answer is 4 remainder 2 (or 4.5).", "The answer is -3.", "The answer is 25%.",
  "The answer is 3 = 3.",
  "No problem! The answer is 12. Look at the board to see each step. Do you have another one?",
  "No problem! The answer is 12. Look at the board to see each step. Want another one?",
  "Not quite, but nice try! The answer is 12. Look at the board to see how. Want another one?",
  "Here's how I solved it! The answer is 12. Do you have another one?",
  "Yes! You got it! The answer is 12. Three in a row! You're amazing, Maya! High five!"
];
