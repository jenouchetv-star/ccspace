-- Chike's Creative Space - AI Lesson 03: Make a Talking 3D Math Robot (Subscriber's Portal, published).
-- Safe to re-run: it replaces the entry with this text, so edits made in the editor belong here too.

insert into portal_entries (id, data) values ('port-ai-lesson-math-robot', jsonb_build_object(
  'id', 'port-ai-lesson-math-robot',
  'slug', 'how-to-build-your-own-math-robot',
  'layout', 'lesson',
  'category', 'AI lessons',
  'status', 'published',
  'publishedAt', '2026-11-01',
  'title', 'AI Lesson 03: Make a Talking 3D Math Robot',
  'description', 'Use AI to build a friendly 3D robot that chats with you, remembers your name, helps with your math homework, quizzes you when you ask, and high-fives you when you do great.',
  'cover', jsonb_build_object('src', 'https://wdctkfhwygwwulipwnys.supabase.co/storage/v1/object/public/uploads/media/1793509939119-Gemini_Generated_Image_78agxd78agxd78ag.jpg', 'alt', 'Children looking at their Math tutoring robot.'),
  'body', $b$<h3>What should we create today?<br>How about A robot that talks, listens, and remembers</h3><p>This time, you are going to ask AI to build a robot buddy that can hold a real conversation. It says hello the right way for the time of day, learns your name and your grade, lets you give it a name of its own, and helps you with math in the way you choose: answering your questions, helping with your homework, or quizzing you when you ask. By the way, your robot is not an AI robot so its responses will be limited.&nbsp;</p><h3>Why such a long prompt?</h3><p>AI only knows what you tell it. If you just say "make a talking robot", AI has to guess how it should talk, what it should remember and when it should cheer, and it will make some of that up. So this prompt spells out every part: what the robot says, how you use it, how it looks, what it remembers, and what it must never do.</p><h3>Be the robot tester</h3><p>When AI has built your robot, chat with it like a friend and try everything in the prompt. If something is missing or different, tell AI exactly what to fix, like "The robot forgot my grade. Make it remember." That is how real app makers work!&nbsp;</p>$b$,
  'steps', jsonb_build_array(
    'Does the robot ask your first name, and then what grade you are in?',
    'If you ask the robot its name, does it ask you to give it one, then use that name?',
    'Does it greet you right for the time of day, and never say "good night"?',
    'Does it ask what you would like to do, and only quiz you when you ask?',
    'Does it answer "How are you?" and "What did you do today?", and ask you something back?',
    'Are the math steps shown on the digital whiteboard behind the robot?',
    'Do the robot''s glowing eyes change shape when you get an answer right or wrong?',
    'After 3 right answers in a row, or when you say "High five!", can you give the robot a high five?',
    'Does Reset robot make it forget everything and start over?'
  ),
  'vocabWord', 'prompt',
  'vocabSay', 'PROMPT · noun',
  'vocabMeaning', 'The words you give AI to tell it what to make or do. The clearer and more detailed your prompt, the less AI has to guess.',
  'vocabExample', 'My prompt told the robot to give me a high five after 3 right answers.',
  'aiPromptTitle', '', 'aiPromptTip', '',
  'aiPrompt', $p$🤖 Robo Math Buddy!
Make a fun, friendly 3D robot math buddy in one HTML file that I can use in my browser. Put all the HTML, CSS and JavaScript in that one file. Use Three.js for the 3D robot and Math.js for the math, both loaded from a CDN.

🌟 What it does:
• The robot talks with me like a friendly buddy, in short, cheerful sentences a 7-year-old can read.
• The first time I visit, it says hello and asks for my first name or a nickname. I have to type my name or nickname before I can do anything else. Then it asks what grade I am in, from Kindergarten to 5th grade.
• I can change my name any time: my name shows at the top of the chat, and I tap it to type a new one. I can also say "Call me ..." or "Change my name".
• If I ask "What is your name?" before I have named it, it says: "I don't have a name yet. Give me a name and I'll use it!" The next thing I say becomes its name, and it says thank you and uses that name from then on.
• It greets me by the time on my computer: "Good morning, [my name]! Ready to learn?" before 12 PM, "Good afternoon, [my name]! How is your day going?" from 12 PM to 5 PM, and "Good evening, [my name]! How are you tonight? Did you have a great day today?" after 5 PM. It never says "good night".
• I am in charge, not the robot. It never starts quizzing me and never makes me answer math questions. Instead it asks what I would like to do: "Do you have a question for me, or would you like help with your homework? I can also quiz you!"
• Suggested replies: little buttons above the text box that I can tap instead of typing. They change to fit what is happening, like "Ask a question", "Homework help", "Quiz me!", "Tell a joke" and "How are you?", or "Great!", "Okay" and "Not so good" when it asks how I am.
• It answers questions like "How are you?", "What is your name?", "What did you do today?", "Tell me a joke" and "What is your favorite color?" with fun robot answers, like "Today I counted 1,000 stars and practiced my high fives!" Then it asks me a question back, so we keep chatting.
• If I say kind things like "I love you", "You're my best friend" or "You're funny", it says something sweet back, like "Aww, I love you too! You make my lights glow!", and its eyes turn into hearts. If I say something unkind, it stays gentle and friendly.
• If it doesn't understand me, it says so kindly and gives me ideas of what I could say or ask.
• Homework help: I type one problem at a time, like "What is 12 times 8?", "15 plus 27", "100 divided by 4" or "3/4 + 1/8", and it shows its work on the board, one step per line, the way kids learn it in school, not just the problem and the answer. For example: counting on for small sums, adding the tens and the ones separately, taking away the tens and then the ones, skip counting for times tables, breaking 24 × 6 into 20 × 6 + 4 × 6, taking away groups for dividing (with any leftover shown as a remainder), lining up the decimal points, and finding 1% first for percents.
• In homework help, the robot never gives me the answer. It shows the work but leaves the last step as a "?", and I type the final answer myself. If I'm right, it cheers, shows the finished board and asks if I have another problem. If I'm not, it says "Not quite!" and lets me try again. I can tap "Give me a hint", "Show me the answer" (only when I ask) or "Something else". It understands answers like "144", "7/8" and "8 R 3".
• If I just ask a math question (not in homework help), it shows its work and the answer.
• Quiz me (only when I ask): it gives me one math question that fits my grade: counting and adding up to 10 for Kindergarten, adding and taking away up to 20 for 1st grade, up to 100 for 2nd grade, times tables up to 10 for 3rd grade, bigger multiplying and sharing (dividing) for 4th grade, and fractions and decimals for 5th grade. While I think, I can tap "Give me a hint", "Show me how" or "Stop the quiz".
• After I answer, it tells me if I am right. If I am not, it gently shows me how to solve it on the board. Then it asks "Want another one?" and I choose "Another one!" or "Something else". It never jumps to the next question by itself.
• When I get 3 answers right in a row (in homework help or a quiz), the robot raises its hand for a high five and says "High five!" I click or tap its hand, it cheers and spins, and my high-five count goes up.
• I can ask for a high five any time by saying "High five!" or tapping the High five button. The robot says "Up top! Tap my hand!" and raises its hand for me to tap.

👆 How to use it:
• A chat window on the left side shows our whole conversation, like a text chat: the robot's messages on the left (they type out letter by letter, like an arcade game) and mine on the right. On a phone, the chat window goes under the robot.
• Type in a text box at the bottom of the chat window and press Enter or the Send button.
• Press a big microphone button to talk instead (it uses the browser's speech recognition and only listens after I press it). If the microphone doesn't work, typing still works.
• A Voice on / Voice off button. It starts on Voice off. Voice on: the robot also reads its words out loud. Voice off: its words only show in the chat window.
• A light mode / dark mode button. It starts in light mode.
• A New question button, for when I want a math question at my grade.
• A Reset robot button. It asks "Are you sure? I will forget everything." If I say yes, it forgets my name, my grade, its own name and my scores, and starts over with hello.
• A Full screen button that fills the whole screen with the robot and the chat, and changes to Exit full screen.
• Drag the robot to turn it a little.

🎨 How it looks:
• An arcade-game look that matches the robot: a dark space-blue background with a glowing cyan grid floor in dark mode, and a soft silver background in light mode. Chunky glossy white buttons with a cyan glow, and arcade score counters in the bottom corner, like "RIGHT 003" and "HIGH 5 001". The Voice, New question, Reset robot and Full screen buttons sit in a row above the robot, as outlined buttons with glowing cyan icons, like the light mode / dark mode button.
• A cute, shiny white 3D robot standing on a glowing hover pad: a big round helmet head with a black visor screen, glowing blue rings on its round ear caps, and two little antennae with balls on top. A round body with a gray chest plate and 4 glowing lights that flash while it talks. Two arms with hands and fingers that hang beside its body (not hidden behind it), and short legs with round feet. It gently floats up and down, and waves hello when I say hi or bye.
• Two glowing cyan eyes on the black visor, shaped like little rounded domes (not human eyes, no pupils). They work like little screens, so they change shape to show feelings: they blink, look around, glance at the chat while I type, turn into happy arches when I'm right, droop when I'm wrong, grow big and sparkly for a high five, turn into pink hearts after a high five, wink after a joke, and squint when the robot is thinking.
• A big digital whiteboard behind the robot (white, with a dark header bar and glowing cyan edges), where the math steps appear in clear dark writing, one step per line, like "12 × 8 = 96", with the answer line in blue.
• Big, easy-to-tap buttons that work on phones, tablets and computers.

💾 What it remembers:
• My name, my grade, the robot's name and my scores, saved only on this computer in the browser's localStorage, so it remembers me next time. It never sends them anywhere.
• If saving is not allowed, it keeps working and just remembers until I close the page.

🚫 Please don't add:
• No ads and no sign-ups.
• No scary sounds or faces.
• Never ask for my last name, address, school, age, birthday, photo or anything else private.$p$,
  'email', jsonb_build_object('on', true, 'subject', 'New AI Lesson: Make a Talking Math Robot',
    'preview', 'Build a 3D robot buddy that chats, remembers you and does math.',
    'message', 'Our newest AI lesson is here! Kids write one detailed prompt and AI builds a friendly 3D robot that greets them, learns their name and grade, helps with math homework, quizzes them when they ask, and gives a high five for great work.' || chr(10) || chr(10) || 'It is a fun way to learn why clear, detailed instructions help AI build exactly what you want. Come and take a look!',
    'button', 'Take a look'),
  'howToPlay', '[]'::jsonb, 'gallery', '[]'::jsonb, 'coverStill', '',
  'gameId', '', 'gamePath', '', 'gameMode', 'launch', 'gameLabel', '', 'privateGameId', 'pg-math-robot', 'privateGameKb', 86,
  'bookId', '', 'bookMode', 'launch', 'bookPath', '', 'videoUrl', '',
  'buttonLabel', '', 'buttonUrl', '', 'textFirst', 'after', 'adminNote', '',
  'createdAt', '2026-11-01T12:00:00.000Z', 'updatedAt', '2026-11-01T12:00:00.000Z'))
on conflict (id) do update set data = excluded.data, updated_at = now();
