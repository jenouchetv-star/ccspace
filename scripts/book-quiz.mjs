// The questions at the end of every book: Let’s find out what you learned! (owner, 2026-11-23, approved in
// docs/mockups/book-quiz-draft.html). Three per grade level: k1 (K and 1st, 2 answers), g23 (2nd and 3rd), g45 (4th to 6th).
// The first choice is the right one; the reader shows them in a new order each time. subject is the STEAMM subject (or
// "reading" for Reading and Writing) the answer counts toward on the progress report. This file is the source: it is
// copied into each book’s learn.quiz (scripts/sync-book-quiz.mjs) and its words are recorded by scripts/record-lines.mjs.
export const BOOK_QUIZ = {
  "story-city-that-sank": {
    "title": "Mateo and the Floating Train",
    "k1": [
      {
        "q": "What did Chike bring to help the train cross?",
        "choices": [
          "Two strong magnets",
          "A tall ladder"
        ],
        "why": "Chike brought two strong magnets to make the train float.",
        "subject": "reading"
      },
      {
        "q": "How did the train get across the gap?",
        "choices": [
          "It floated",
          "It swam"
        ],
        "why": "Magnets lifted the train, so it floated across.",
        "subject": "science"
      },
      {
        "q": "Mateo, Chike and Yuna were in the workshop. How many friends is that?",
        "choices": [
          "3",
          "5"
        ],
        "why": "Mateo, Chike and Yuna: 1, 2, 3 friends.",
        "subject": "math"
      }
    ],
    "g23": [
      {
        "q": "How did Mateo’s train cross the gap without a bridge?",
        "choices": [
          "It floated on magnets",
          "It jumped across",
          "It rolled on a rope"
        ],
        "why": "Mateo put matching magnets on the train and the track, so the train floated across.",
        "subject": "reading"
      },
      {
        "q": "What happens when the same sides of two magnets face each other?",
        "choices": [
          "They push away",
          "They stick together",
          "Nothing happens"
        ],
        "why": "The same sides of magnets push away from each other. That is what lifted the train.",
        "subject": "science"
      },
      {
        "q": "What is a maglev train?",
        "choices": [
          "A train that floats above its track using magnets",
          "A train with giant wheels",
          "A train that runs on water"
        ],
        "why": "Maglev trains float above the track with magnets, so no wheels touch it.",
        "subject": "technology"
      }
    ],
    "g45": [
      {
        "q": "Why did the floating train move faster than a train with wheels?",
        "choices": [
          "Nothing touched the track, so there was less friction",
          "The magnets made it lighter",
          "The track went downhill"
        ],
        "why": "Friction is the rubbing that slows things down. With no wheels touching the track, there was much less of it.",
        "subject": "science"
      },
      {
        "q": "If the train’s magnets were flipped so opposite sides faced the track, what would happen?",
        "choices": [
          "The train would stick to the track",
          "The train would float higher",
          "Nothing would change"
        ],
        "why": "Opposite sides of magnets pull together, so the train would be pulled down onto the track.",
        "subject": "science"
      },
      {
        "q": "Mateo wants a track that goes up the wall. What force must its magnets be strong enough to beat?",
        "choices": [
          "Gravity",
          "Friction",
          "Wind"
        ],
        "why": "Gravity pulls everything down, so a wall track has to hold the train up against it.",
        "subject": "engineering"
      }
    ]
  },
  "book-space-adventure": {
    "title": "Chike and Zech’s Space Adventure",
    "k1": [
      {
        "q": "What did Chike and Zech build?",
        "choices": [
          "A rocket",
          "A boat"
        ],
        "why": "They built a shiny rocket ship from things they had at home.",
        "subject": "reading"
      },
      {
        "q": "What did they make their helmets from?",
        "choices": [
          "Cereal boxes",
          "Flower pots"
        ],
        "why": "They made astronaut helmets out of cereal boxes.",
        "subject": "art"
      },
      {
        "q": "Zech’s planet Zectune had swirly what?",
        "choices": [
          "Rings",
          "Wheels"
        ],
        "why": "Zectune had swirly rings, like the real planet Saturn.",
        "subject": "science"
      }
    ],
    "g23": [
      {
        "q": "What did Chike and Zech build their rocket from?",
        "choices": [
          "Cardboard, tape, foil and markers",
          "A real rocket kit",
          "Wood and nails"
        ],
        "why": "They built with what they had at home: cardboard, tape, foil and markers.",
        "subject": "engineering"
      },
      {
        "q": "What is a galaxy?",
        "choices": [
          "A huge group of stars in space",
          "A kind of rocket",
          "A planet with rings"
        ],
        "why": "A galaxy is a huge group of stars out in space.",
        "subject": "science"
      },
      {
        "q": "What did Zech name the biggest planet?",
        "choices": [
          "Zectune",
          "Chikopia",
          "Mars"
        ],
        "why": "Zech named the biggest planet Zectune. Chike named his Chikopia.",
        "subject": "reading"
      }
    ],
    "g45": [
      {
        "q": "Real planets like Saturn have rings. What are Saturn’s rings mostly made of?",
        "choices": [
          "Pieces of ice and rock",
          "Gas and smoke",
          "Rainbows of light"
        ],
        "why": "Saturn’s rings are made of billions of pieces of ice and rock circling the planet.",
        "subject": "science"
      },
      {
        "q": "Why is building with boxes and foil you already have a smart way to make things?",
        "choices": [
          "It saves money and keeps things out of the trash",
          "It makes things heavier",
          "It is the only way to build a rocket"
        ],
        "why": "Reusing materials saves money and keeps waste out of the trash, just like Chike and Zech did.",
        "subject": "engineering"
      },
      {
        "q": "How did Chike and Zech fly to Chikopia?",
        "choices": [
          "In their imaginations",
          "In a real spaceship",
          "On an airplane"
        ],
        "why": "Their rocket flew in their imaginations. Their bedroom became a whole galaxy.",
        "subject": "reading"
      }
    ]
  },
  "story-drawing-nobody-understood": {
    "title": "Kiyah’s Garden of Tiny Clues",
    "k1": [
      {
        "q": "What did Kiyah want to draw?",
        "choices": [
          "The garden",
          "A car"
        ],
        "why": "Kiyah was trying to draw the garden.",
        "subject": "reading"
      },
      {
        "q": "Which tool makes small things look bigger?",
        "choices": [
          "A magnifying glass",
          "A hammer"
        ],
        "why": "A magnifying glass makes small things look bigger.",
        "subject": "science"
      },
      {
        "q": "Kiyah drew a bee, a leaf and a ladybug. How many things is that?",
        "choices": [
          "3",
          "2"
        ],
        "why": "A bee, a leaf and a ladybug: 1, 2, 3 things.",
        "subject": "math"
      }
    ],
    "g23": [
      {
        "q": "What tool helped Kiyah look really, really close?",
        "choices": [
          "A magnifying glass",
          "A telescope",
          "A flashlight"
        ],
        "why": "A magnifying glass makes small things look bigger.",
        "subject": "science"
      },
      {
        "q": "What did Kiyah see on the bee?",
        "choices": [
          "Yellow pollen",
          "Blue paint",
          "Raindrops"
        ],
        "why": "Up close, Kiyah saw yellow pollen on the bee.",
        "subject": "reading"
      },
      {
        "q": "How did Kiyah finish her garden picture?",
        "choices": [
          "She drew one small thing at a time",
          "She copied a photo",
          "She drew it all at once"
        ],
        "why": "Kiyah stopped trying to make it perfect and drew one small thing at a time.",
        "subject": "art"
      }
    ],
    "g45": [
      {
        "q": "Bees carry pollen from flower to flower. Why does that matter?",
        "choices": [
          "It helps plants make seeds and fruit",
          "It makes flowers smell sweeter",
          "It keeps bees warm"
        ],
        "why": "Moving pollen between flowers helps plants make seeds and fruit.",
        "subject": "science"
      },
      {
        "q": "Why was it hard for Kiyah to draw the garden at first?",
        "choices": [
          "Everything kept moving",
          "She had no paper",
          "It was too dark"
        ],
        "why": "The flowers swayed and the butterflies flew away every time she started.",
        "subject": "reading"
      },
      {
        "q": "What did Kiyah learn about making art?",
        "choices": [
          "Paying attention matters more than being perfect",
          "Art should only show things that stay still",
          "Drawing is too hard"
        ],
        "why": "Kiyah said she did not need to make it perfect. She just needed to pay attention.",
        "subject": "art"
      }
    ]
  },
  "story-fold-that-would-not": {
    "title": "Zech’s Paper Airplane Parade",
    "k1": [
      {
        "q": "What did Zech and Corey make?",
        "choices": [
          "Paper airplanes",
          "Kites"
        ],
        "why": "They folded paper airplanes.",
        "subject": "reading"
      },
      {
        "q": "Zech’s plane had a pointy nose. Corey’s plane had wide what?",
        "choices": [
          "Wings",
          "Wheels"
        ],
        "why": "Corey folded wide wings for smooth flying.",
        "subject": "engineering"
      },
      {
        "q": "The team plane flew far on its third try. How many tries is that?",
        "choices": [
          "3",
          "1"
        ],
        "why": "Third means number 3: one, two, three tries.",
        "subject": "math"
      }
    ],
    "g23": [
      {
        "q": "What does glide mean?",
        "choices": [
          "To fly smoothly and gently",
          "To fall straight down",
          "To spin around fast"
        ],
        "why": "To glide is to fly smoothly and gently through the air.",
        "subject": "reading"
      },
      {
        "q": "What made the team plane fly so far?",
        "choices": [
          "Zech’s pointy nose with Corey’s wide wings",
          "A bigger sheet of paper",
          "Throwing it harder"
        ],
        "why": "They mixed the best of two ideas: Zech’s pointed nose and Corey’s wide, balanced wings.",
        "subject": "engineering"
      },
      {
        "q": "Where did the team plane glide to?",
        "choices": [
          "The treehouse",
          "A bush",
          "The pond"
        ],
        "why": "On the third try, it glided all the way to the treehouse.",
        "subject": "reading"
      }
    ],
    "g45": [
      {
        "q": "Why do wide wings help a paper plane stay up longer?",
        "choices": [
          "They push against more air, which helps hold the plane up",
          "They make the plane heavier",
          "They make it spin faster"
        ],
        "why": "Bigger wings push against more air, and the air pushing back helps the plane stay up.",
        "subject": "science"
      },
      {
        "q": "Zech and Corey tested, changed their plane and tested again. What is that called?",
        "choices": [
          "Improving a design",
          "Guessing",
          "Giving up"
        ],
        "why": "Engineers test, change and test again to improve a design.",
        "subject": "engineering"
      },
      {
        "q": "What is the main idea of the story?",
        "choices": [
          "Mixing two ideas can make something better",
          "Fast planes are always best",
          "It is better to work alone"
        ],
        "why": "Neither plane worked alone, but together their ideas flew all the way to the treehouse.",
        "subject": "reading"
      }
    ]
  },
  "story-question-mark": {
    "title": "Chike and His Flying Box",
    "k1": [
      {
        "q": "What did Chike find?",
        "choices": [
          "A big box",
          "A bike"
        ],
        "why": "Chike found a big empty box beside the recycling bin.",
        "subject": "reading"
      },
      {
        "q": "After the first test, what happened to the wings?",
        "choices": [
          "They folded",
          "They grew"
        ],
        "why": "The box tipped into the grass and the wings folded.",
        "subject": "reading"
      },
      {
        "q": "What makes something stronger: more support or less?",
        "choices": [
          "More support",
          "Less support"
        ],
        "why": "Extra pieces that hold something up make it stronger.",
        "subject": "engineering"
      }
    ],
    "g23": [
      {
        "q": "What happened on the Sky Spark’s first test?",
        "choices": [
          "It tipped over and the wings folded",
          "It flew over the house",
          "It rolled into the street"
        ],
        "why": "The box tipped gently into the grass, and the wings folded.",
        "subject": "reading"
      },
      {
        "q": "What is a brace?",
        "choices": [
          "An extra piece that holds something up",
          "A kind of tape",
          "A wheel"
        ],
        "why": "A brace is an extra piece added to hold something up and make it stronger.",
        "subject": "engineering"
      },
      {
        "q": "What did the first test teach them?",
        "choices": [
          "The wings needed more support",
          "Boxes can’t be decorated",
          "They needed a bigger box"
        ],
        "why": "Every test teaches something. Theirs showed the wings needed more support.",
        "subject": "engineering"
      }
    ],
    "g45": [
      {
        "q": "Why does a wider base make the Sky Spark steadier?",
        "choices": [
          "It spreads the weight out, so it tips over less",
          "It makes the box lighter",
          "It makes it go faster"
        ],
        "why": "A wider base spreads the weight out, so it is harder to tip over.",
        "subject": "engineering"
      },
      {
        "q": "Chike said, “We made a better idea.” What did he mean?",
        "choices": [
          "They learned from each test, even though it did not fly",
          "They gave up on building",
          "They built a real airplane"
        ],
        "why": "The box never truly flew, but each test taught them how to make it better.",
        "subject": "reading"
      },
      {
        "q": "The Sky Spark rolled down the hill. What pulled it down?",
        "choices": [
          "Gravity",
          "Wind",
          "Magnets"
        ],
        "why": "Gravity pulls things down, so the box rolled down the hill.",
        "subject": "science"
      }
    ]
  },
  "story-slowest-dancer": {
    "title": "Averi’s Brave First Step",
    "k1": [
      {
        "q": "What was Averi getting ready to do?",
        "choices": [
          "Dance on a stage",
          "Swim in a race"
        ],
        "why": "Averi had a dance on the big school stage.",
        "subject": "reading"
      },
      {
        "q": "How many chalk stars did Averi and Yuna draw?",
        "choices": [
          "3",
          "10"
        ],
        "why": "They drew three chalk stars: beginning, middle and ending.",
        "subject": "math"
      },
      {
        "q": "Butterflies in your tummy means you feel...",
        "choices": [
          "Nervous",
          "Sleepy"
        ],
        "why": "Nervous is the jittery feeling you can get before something big.",
        "subject": "reading"
      }
    ],
    "g23": [
      {
        "q": "What did Averi and Yuna draw on the sidewalk?",
        "choices": [
          "Three chalk stars",
          "A big circle",
          "A hopscotch"
        ],
        "why": "They drew three chalk stars: one for the beginning, middle and ending.",
        "subject": "reading"
      },
      {
        "q": "What did Averi practice on the second star?",
        "choices": [
          "Her trickiest turn",
          "Her bow",
          "Her first step"
        ],
        "why": "On the second star she practiced her trickiest turn. She wobbled, then spun all the way around.",
        "subject": "art"
      },
      {
        "q": "What made Averi brave?",
        "choices": [
          "Dancing even while she felt nervous",
          "Never feeling nervous",
          "Skipping the show"
        ],
        "why": "Averi did not wait to feel unafraid. She danced while feeling nervous, and that made her brave.",
        "subject": "reading"
      }
    ],
    "g45": [
      {
        "q": "Yuna said stories have a beginning, middle and ending. How did Averi use that idea?",
        "choices": [
          "She split her dance into three parts to practice",
          "She wrote a new story",
          "She picked a new song"
        ],
        "why": "Averi practiced her dance in three parts, one on each chalk star.",
        "subject": "art"
      },
      {
        "q": "Averi wobbled on her turn the first time. What did she do next?",
        "choices": [
          "Kept practicing until she spun all the way around",
          "Took the turn out of her dance",
          "Asked to skip the show"
        ],
        "why": "She wobbled the first time, then kept going and spun all the way around.",
        "subject": "reading"
      },
      {
        "q": "Which sentence best tells the story’s lesson?",
        "choices": [
          "Being brave means trying even when you feel scared",
          "Only dance when you are not nervous",
          "Big stages are too scary"
        ],
        "why": "Averi was nervous and danced anyway. That is what being brave means.",
        "subject": "reading"
      }
    ]
  },
  "story-song-in-the-rain": {
    "title": "Stacey and the Sound of Sunshine",
    "k1": [
      {
        "q": "What instrument did Stacey play?",
        "choices": [
          "A guitar",
          "A drum"
        ],
        "why": "Stacey played her song on a guitar.",
        "subject": "music"
      },
      {
        "q": "What was Stacey’s song about?",
        "choices": [
          "A sunny day",
          "A snowy day"
        ],
        "why": "Her song was called the Sunny Day Song.",
        "subject": "reading"
      },
      {
        "q": "Slow, quick, slow. How many parts is that?",
        "choices": [
          "3",
          "2"
        ],
        "why": "Slow, quick, slow: 1, 2, 3 parts.",
        "subject": "math"
      }
    ],
    "g23": [
      {
        "q": "What is a chord?",
        "choices": [
          "A group of notes played together",
          "A guitar string",
          "A quiet song"
        ],
        "why": "A chord is a group of musical notes played together at the same time.",
        "subject": "music"
      },
      {
        "q": "What gave Zech the idea for the rhythm?",
        "choices": [
          "Sunlight moving on the floor",
          "Rain on the window",
          "A bird singing"
        ],
        "why": "Zech watched the sunlight moving on the floor and said the music could move like that.",
        "subject": "reading"
      },
      {
        "q": "What rhythm did Zech suggest?",
        "choices": [
          "Slow, quick, slow",
          "Fast, fast, fast",
          "Loud, soft, loud"
        ],
        "why": "Slow, quick, slow: one long chord, two quick notes, one warm strum.",
        "subject": "music"
      }
    ],
    "g45": [
      {
        "q": "What is rhythm in music?",
        "choices": [
          "The pattern of long and short sounds",
          "How high or low a note is",
          "How loud the music is"
        ],
        "why": "Rhythm is the pattern of long and short sounds, like slow, quick, slow.",
        "subject": "music"
      },
      {
        "q": "A chord is notes played together. What is a melody?",
        "choices": [
          "Notes played one after another as a tune",
          "All the notes played at once",
          "Only the drum part"
        ],
        "why": "A melody is a tune: notes played one after another.",
        "subject": "music"
      },
      {
        "q": "Why did Stacey play the whole song again at the end?",
        "choices": [
          "It finally sounded like her",
          "It was perfect",
          "Her friends asked her to"
        ],
        "why": "She played it again not because it was perfect, but because now it sounded like her.",
        "subject": "reading"
      }
    ]
  },
  "story-train-with-no-signals": {
    "title": "Zech’s Windmill Power",
    "k1": [
      {
        "q": "What did Zech make?",
        "choices": [
          "A pinwheel",
          "A paper boat"
        ],
        "why": "Zech made a giant green paper pinwheel.",
        "subject": "reading"
      },
      {
        "q": "What made the pinwheel spin?",
        "choices": [
          "Wind",
          "Water"
        ],
        "why": "Moving air, the wind, pushed the blades around.",
        "subject": "science"
      },
      {
        "q": "What lit up when the pinwheel spun?",
        "choices": [
          "A tiny light",
          "A TV"
        ],
        "why": "The spinning made electricity, and a tiny light came on.",
        "subject": "technology"
      }
    ],
    "g23": [
      {
        "q": "What is kinetic energy?",
        "choices": [
          "Energy from movement",
          "Energy from food",
          "Energy in a battery"
        ],
        "why": "Kinetic energy is the energy something has because it is moving, like the wind.",
        "subject": "science"
      },
      {
        "q": "What made the electricity when the blades spun?",
        "choices": [
          "A tiny generator",
          "A battery",
          "The paper"
        ],
        "why": "As the wind pushed the blades, a tiny generator inside spun and made real electricity.",
        "subject": "engineering"
      },
      {
        "q": "Why did Zech curve the blades?",
        "choices": [
          "To catch even the softest breeze",
          "To make them look pretty",
          "To make them heavier"
        ],
        "why": "Curved blades catch even the softest breeze.",
        "subject": "engineering"
      }
    ],
    "g45": [
      {
        "q": "Wind turbines make electricity without burning fuel. What kind of energy is wind?",
        "choices": [
          "Renewable: it never runs out",
          "A fossil fuel",
          "Battery power"
        ],
        "why": "Wind keeps blowing, so it is a renewable energy that never runs out.",
        "subject": "science"
      },
      {
        "q": "In Zech’s pinwheel, which order shows how the energy changed?",
        "choices": [
          "Moving air, spinning blades, electricity, light",
          "Light, electricity, moving air",
          "Electricity, moving air, spinning blades"
        ],
        "why": "The wind spun the blades, the generator made electricity, and the electricity lit the light.",
        "subject": "science"
      },
      {
        "q": "Why did the light blink on only when a breeze came in?",
        "choices": [
          "The blades only made power while the wind pushed them",
          "The bulb was broken",
          "Stacey turned it on"
        ],
        "why": "With no wind, the blades stop, so no electricity is made and the light goes out.",
        "subject": "technology"
      }
    ]
  }
};
