// The two questions Chike asks after an episode or a hands-on activity (owner, 2026-11-24). Keys are
// "episode:<video id>" or "activity:<activity id>"; each item is written from its learning fact alone. Three levels:
// k1 (K and 1st, 2 answers), g23 (2nd and 3rd, 3 answers), g45 (4th to 6th, 3 or 4 answers). The first choice is the
// right one; the site shows them in a new order each time. Four per level: questions 1-2 the first time a child
// finishes the item, 3-4 the second time. subject is the STEAMM subject (or "reading" for Reading and Writing) the
// answers count toward on the progress report. Review page: docs/mockups/item-quiz-review.html.
export const ITEM_QUIZ = {
  "episode:vid-ep1": {
    "title": "Chike Explores the Solar System",
    "subject": "science",
    "k1": [
      {
        "q": "Which planet takes longer to go around the sun?",
        "choices": [
          "Neptune, far away",
          "Earth"
        ],
        "why": "Neptune is far from the sun, so its trip takes much longer."
      },
      {
        "q": "How long does Earth take to go around the sun?",
        "choices": [
          "One year",
          "One day"
        ],
        "why": "Earth takes one year to go all the way around the sun."
      },
      {
        "q": "A planet far from the sun has a path that is...",
        "choices": [
          "Longer",
          "Shorter"
        ],
        "why": "The farther out a planet is, the longer its path around the sun."
      },
      {
        "q": "Chike sees a planet close to the sun. Is its trip short or long?",
        "choices": [
          "Short",
          "Long"
        ],
        "why": "Planets closer to the sun have a shorter path, so their trip is quicker."
      }
    ],
    "g23": [
      {
        "q": "About how many of our years does Neptune take to go around the sun?",
        "choices": [
          "About 165",
          "About 1",
          "About 10"
        ],
        "why": "Faraway Neptune takes about 165 of our years to go around the sun."
      },
      {
        "q": "Why does a faraway planet take longer to go around the sun?",
        "choices": [
          "Its path is longer",
          "It is heavier",
          "The sun pushes it back"
        ],
        "why": "The farther out a planet is, the longer its path around the sun."
      },
      {
        "q": "What does Earth do in one year?",
        "choices": [
          "Goes once around the sun",
          "Goes around Neptune",
          "Goes around the sun 165 times"
        ],
        "why": "Earth takes one year to go all the way around the sun."
      },
      {
        "q": "Planet A is near the sun. Planet B is far out. Which finishes a trip first?",
        "choices": [
          "Planet A",
          "Planet B",
          "They tie"
        ],
        "why": "Planets farther from the sun take longer, so the nearer one finishes first."
      }
    ],
    "g45": [
      {
        "q": "When Neptune finishes one trip around the sun, about how many Earth years pass?",
        "choices": [
          "About 165",
          "About 16",
          "About 1",
          "About 1,000"
        ],
        "why": "Neptune takes about 165 of our years to go around the sun once."
      },
      {
        "q": "A new planet is found far beyond Neptune. What would you predict?",
        "choices": [
          "Its trip takes longer than Neptune’s",
          "Its trip takes less than a year",
          "Its trip takes exactly one year"
        ],
        "why": "The farther out a planet is, the longer its path, so its trip would take even longer."
      },
      {
        "q": "Which pattern does the episode show?",
        "choices": [
          "Farther out means a longer trip",
          "Bigger means a faster trip",
          "All planets take one year",
          "Closer means a longer trip"
        ],
        "why": "Planets farther from the sun take much longer to travel around it."
      },
      {
        "q": "You are 10 when Neptune starts a trip. About how old are you when it ends?",
        "choices": [
          "About 175",
          "About 11",
          "About 20"
        ],
        "why": "Neptune takes about 165 years, and 10 plus 165 is 175."
      }
    ]
  },
  "episode:vid-ep2": {
    "title": "Dinosaur Adventure with Chike and Zech",
    "subject": "science",
    "k1": [
      {
        "q": "What is a fossil?",
        "choices": [
          "Something left from long ago",
          "A brand new rock"
        ],
        "why": "Fossils are traces left behind by living things from long ago."
      },
      {
        "q": "Can a footprint become a fossil?",
        "choices": [
          "Yes",
          "No"
        ],
        "why": "Even footprints can slowly turn to stone and become fossils."
      },
      {
        "q": "Fossils slowly turn into...",
        "choices": [
          "Stone",
          "Water"
        ],
        "why": "Over millions of years, bones, teeth and shells slowly turn to stone."
      },
      {
        "q": "Why do scientists study fossils?",
        "choices": [
          "To learn about dinosaurs",
          "To make them grow"
        ],
        "why": "Scientists study fossils to learn what dinosaurs looked like and how they lived."
      }
    ],
    "g23": [
      {
        "q": "Which of these can become a fossil?",
        "choices": [
          "A dinosaur tooth",
          "A cloud",
          "A song"
        ],
        "why": "Bones, teeth, shells and even footprints can become fossils."
      },
      {
        "q": "How long does it take a bone to turn to stone?",
        "choices": [
          "Millions of years",
          "One week",
          "A few hours"
        ],
        "why": "Bones slowly turn to stone over millions of years."
      },
      {
        "q": "What can fossils tell scientists about dinosaurs?",
        "choices": [
          "How they looked and lived",
          "What their names were",
          "What color the sky was"
        ],
        "why": "Scientists study fossils to learn what dinosaurs looked like and how they lived."
      },
      {
        "q": "Zech finds a shell that has turned to stone. What is it?",
        "choices": [
          "A fossil",
          "A crystal",
          "A seed"
        ],
        "why": "A shell that slowly turned to stone is a fossil."
      }
    ],
    "g45": [
      {
        "q": "Which list shows things that can become fossils?",
        "choices": [
          "Bones, teeth, shells, footprints",
          "Bones, clouds, songs",
          "Wind, shadows, footprints"
        ],
        "why": "Bones, teeth, shells and even footprints can slowly turn to stone."
      },
      {
        "q": "Why can a footprint count as a fossil, even with no bones in it?",
        "choices": [
          "It is a trace left by a living thing",
          "It was made last week",
          "It is made of metal"
        ],
        "why": "Fossils are traces left by living things, and a footprint is a trace."
      },
      {
        "q": "No one saw dinosaurs alive. How do fossils help us know them?",
        "choices": [
          "They show how dinosaurs looked and lived",
          "They are photos taken long ago",
          "They are drawings made by dinosaurs"
        ],
        "why": "Scientists study fossils to learn what dinosaurs looked like and how they lived."
      },
      {
        "q": "What has to happen for a bone to become a fossil?",
        "choices": [
          "It turns to stone over millions of years",
          "It gets painted gray",
          "It is frozen for a day"
        ],
        "why": "Bones slowly turn to stone over millions of years."
      }
    ]
  },
  "episode:vid-ep3": {
    "title": "Chike and Mateo's Epic Volcano Adventure",
    "subject": "science",
    "k1": [
      {
        "q": "What is lava?",
        "choices": [
          "Melted rock",
          "Hot water"
        ],
        "why": "Lava is melted rock that comes up from beneath the surface."
      },
      {
        "q": "Where does lava come out?",
        "choices": [
          "A volcano",
          "A tree"
        ],
        "why": "When magma pushes out of a volcano, it is called lava."
      },
      {
        "q": "When lava cools down, what does it become?",
        "choices": [
          "New rock",
          "Ice"
        ],
        "why": "Lava cools and hardens into new rock."
      },
      {
        "q": "Is it hot or cold deep under the ground?",
        "choices": [
          "Very hot",
          "Very cold"
        ],
        "why": "Deep underground it is so hot that rock melts."
      }
    ],
    "g23": [
      {
        "q": "What do we call melted rock while it is still underground?",
        "choices": [
          "Magma",
          "Lava",
          "Sand"
        ],
        "why": "Deep underground, melted rock is called magma."
      },
      {
        "q": "When does magma get called lava?",
        "choices": [
          "When it comes out of a volcano",
          "When it freezes",
          "When it rains"
        ],
        "why": "When magma pushes out of a volcano, it is called lava."
      },
      {
        "q": "Why does rock melt deep underground?",
        "choices": [
          "It is very hot there",
          "Water soaks it",
          "Wind blows on it"
        ],
        "why": "Deep underground it is so hot that rock melts into magma."
      },
      {
        "q": "What happens to lava after it cools?",
        "choices": [
          "It hardens into new rock",
          "It turns into water",
          "It floats away"
        ],
        "why": "Lava cools and hardens into new rock."
      }
    ],
    "g45": [
      {
        "q": "What is the difference between magma and lava?",
        "choices": [
          "Magma is inside; lava has come out",
          "Magma is cold, lava is hot",
          "Lava is a gas",
          "They are different colors"
        ],
        "why": "Melted rock is magma underground and lava once it pushes out of a volcano."
      },
      {
        "q": "Mateo finds dark rock near an old volcano. How could it have formed?",
        "choices": [
          "Lava cooled and hardened",
          "Rain froze into stone",
          "Sand melted in the sun"
        ],
        "why": "Lava cools and hardens into new rock."
      },
      {
        "q": "Which order is right?",
        "choices": [
          "Magma, then lava, then new rock",
          "Lava, then magma, then new rock",
          "New rock, then lava, then magma"
        ],
        "why": "Rock melts into magma, pushes out as lava, then cools into new rock."
      },
      {
        "q": "Why is lava runny when it first comes out?",
        "choices": [
          "It is rock that heat has melted",
          "It is mixed with rainwater",
          "It is made of mud"
        ],
        "why": "Deep underground it is so hot that rock melts, and that melted rock comes out as lava."
      }
    ]
  },
  "episode:vid-ep4": {
    "title": "Zech's High-Altitude Adventure",
    "subject": "science",
    "k1": [
      {
        "q": "What does altitude mean?",
        "choices": [
          "How high something is",
          "How fast something is"
        ],
        "why": "Altitude is how high something is above the ground."
      },
      {
        "q": "As you go higher, the air gets...",
        "choices": [
          "Colder",
          "Hotter"
        ],
        "why": "The higher you go, the colder the air gets."
      },
      {
        "q": "Where do big passenger planes usually fly?",
        "choices": [
          "Above the clouds",
          "Under the trees"
        ],
        "why": "Big passenger planes usually fly far above the clouds."
      },
      {
        "q": "Do birds and planes fly at the same height?",
        "choices": [
          "No, different heights",
          "Yes, always the same"
        ],
        "why": "Birds, clouds and airplanes all fly at different altitudes."
      }
    ],
    "g23": [
      {
        "q": "A plane climbs higher. What happens to the air around it?",
        "choices": [
          "It gets colder and thinner",
          "It gets warmer and thicker",
          "It stays the same"
        ],
        "why": "The higher you go, the colder and thinner the air gets."
      },
      {
        "q": "Zech flies above the clouds. Is that a high or low altitude?",
        "choices": [
          "High altitude",
          "Low altitude",
          "No altitude"
        ],
        "why": "Altitude is how high something is, and above the clouds is very high."
      },
      {
        "q": "Which word means how high something is above the ground?",
        "choices": [
          "Altitude",
          "Speed",
          "Weather"
        ],
        "why": "Altitude is how high something is above the ground."
      },
      {
        "q": "Why might a climber need a warm coat near the top of a tall mountain?",
        "choices": [
          "Higher up, the air is colder",
          "Wind is always warm",
          "It is always nighttime there"
        ],
        "why": "The higher you go, the colder the air gets."
      }
    ],
    "g45": [
      {
        "q": "A cloud floats with a jet far above it. Which has the greater altitude?",
        "choices": [
          "The jet",
          "The cloud",
          "They are equal"
        ],
        "why": "Altitude is how high something is, and the jet is higher."
      },
      {
        "q": "Which two ways does the air change as altitude goes up?",
        "choices": [
          "It gets colder and thinner",
          "It gets warmer and thicker",
          "It gets wetter and louder",
          "It gets thicker and colder"
        ],
        "why": "The higher you go, the colder and thinner the air gets."
      },
      {
        "q": "A balloon rises from 100 feet to 1,000 feet. What happened to its altitude?",
        "choices": [
          "It went up",
          "It went down",
          "It stayed the same"
        ],
        "why": "Altitude is how high something is, so rising means its altitude went up."
      },
      {
        "q": "Zech climbs a tall hill and the air feels thin. What explains it?",
        "choices": [
          "Higher altitude means thinner air",
          "The hill blocks the air",
          "Thin air comes from rain"
        ],
        "why": "The higher you go, the thinner the air gets."
      }
    ]
  },
  "episode:vid-ep6": {
    "title": "Stacey's Sunny Day",
    "subject": "music",
    "k1": [
      {
        "q": "What is rhythm?",
        "choices": [
          "A pattern of beats",
          "A kind of color"
        ],
        "why": "Rhythm is a pattern of beats."
      },
      {
        "q": "A part is tricky. How should you practice it first?",
        "choices": [
          "Slowly",
          "Super fast"
        ],
        "why": "Playing a hard part slowly first helps your hands learn it."
      },
      {
        "q": "What can your hands do to feel a steady beat?",
        "choices": [
          "Clap",
          "Sit still"
        ],
        "why": "Clap a steady beat and you can feel the rhythm."
      },
      {
        "q": "After you play it slowly, what do you do the next time?",
        "choices": [
          "Go a little faster",
          "Go much slower"
        ],
        "why": "Play it slowly first, then a little faster each time."
      }
    ],
    "g23": [
      {
        "q": "Stacey has a hard part to learn. What is the best plan?",
        "choices": [
          "Slow first, then a bit faster",
          "Fast right away",
          "Skip the hard part"
        ],
        "why": "Playing slowly first, then a little faster each time, helps your hands learn it."
      },
      {
        "q": "Why practice a tricky part slowly?",
        "choices": [
          "It helps your hands learn it",
          "It makes the song shorter",
          "It makes it louder"
        ],
        "why": "Playing a hard part slowly helps your hands learn it."
      },
      {
        "q": "What kind of beat do you clap to feel a rhythm?",
        "choices": [
          "A steady beat",
          "A random beat",
          "No beat at all"
        ],
        "why": "Clap a steady beat and you can feel the rhythm."
      },
      {
        "q": "Which of these is a rhythm?",
        "choices": [
          "Clap, clap, rest, clap, clap, rest",
          "One clap, then silence",
          "Noises with no pattern"
        ],
        "why": "Rhythm is a pattern of beats, and this one repeats."
      }
    ],
    "g45": [
      {
        "q": "Why does speeding up a little each time work better than starting fast?",
        "choices": [
          "Your hands learn it step by step",
          "Fast playing makes no sound",
          "Slow playing changes the song"
        ],
        "why": "Playing slowly first, then a little faster each time, helps your hands learn it."
      },
      {
        "q": "A friend keeps tripping on a hard part of a song. What advice fits?",
        "choices": [
          "Play it slowly, then speed up bit by bit",
          "Play it faster until it works",
          "Never play that part again"
        ],
        "why": "Practicing a tricky part slowly, then faster, helps it sound right."
      },
      {
        "q": "What makes a set of beats a rhythm?",
        "choices": [
          "They form a pattern",
          "They are very loud",
          "They are played once"
        ],
        "why": "Rhythm is a pattern of beats."
      },
      {
        "q": "Practicing slowly helps a tricky part sound how?",
        "choices": [
          "The way you imagined it",
          "Completely different",
          "Quieter than before"
        ],
        "why": "Practicing a tricky part slowly helps it sound the way you imagined."
      }
    ]
  },
  "episode:vid-garden-map": {
    "title": "Kiyah's Bee-utiful Drawing",
    "subject": "science",
    "k1": [
      {
        "q": "What does a bee carry from flower to flower?",
        "choices": [
          "Pollen",
          "Rocks"
        ],
        "why": "A bee moves pollen from flower to flower."
      },
      {
        "q": "Why does a bee visit a flower?",
        "choices": [
          "For sweet nectar",
          "To take a nap"
        ],
        "why": "A bee visits a flower for its sweet nectar."
      },
      {
        "q": "Where does pollen stick on a bee?",
        "choices": [
          "Its fuzzy body",
          "Its tiny hat"
        ],
        "why": "Pollen sticks to the bee’s fuzzy body."
      },
      {
        "q": "Bees help plants make...",
        "choices": [
          "Seeds",
          "Shoes"
        ],
        "why": "Moving pollen is how many plants make seeds."
      }
    ],
    "g23": [
      {
        "q": "What happens when a bee lands on the next flower?",
        "choices": [
          "Some pollen rubs off",
          "The flower closes forever",
          "The bee drops its nectar"
        ],
        "why": "At the next flower, some of the pollen rubs off."
      },
      {
        "q": "Why does pollen stick to a bee so easily?",
        "choices": [
          "Its body is fuzzy",
          "It is wet with rain",
          "The flower glues it on"
        ],
        "why": "Pollen sticks to the bee’s fuzzy body."
      },
      {
        "q": "The bee gets nectar. What does the flower get?",
        "choices": [
          "Its pollen moved to another flower",
          "A drink of water",
          "New leaves"
        ],
        "why": "When the bee visits for nectar, it carries the flower’s pollen to the next one."
      },
      {
        "q": "Bees help plants make seeds and what else?",
        "choices": [
          "Fruit",
          "Rain",
          "Rocks"
        ],
        "why": "Pollen rubbing off helps the plant make seeds and fruit."
      }
    ],
    "g45": [
      {
        "q": "The bee only came for nectar. How does its visit still help the plant?",
        "choices": [
          "It moves pollen so seeds can form",
          "It waters the flower",
          "It eats harmful leaves"
        ],
        "why": "The bee carries pollen to the next flower, and that helps the plant make seeds."
      },
      {
        "q": "Why would a garden with no bees grow less fruit?",
        "choices": [
          "Less pollen would move between flowers",
          "Bees make the rain fall",
          "Fruit needs bee nectar to grow"
        ],
        "why": "Pollen moving from flower to flower helps plants make seeds and fruit."
      },
      {
        "q": "Pollen sticks to a bee. What happens next?",
        "choices": [
          "The bee carries it to the next flower",
          "The flower makes more nectar",
          "The fruit falls off"
        ],
        "why": "The bee carries the pollen to the next flower, where some rubs off."
      },
      {
        "q": "Imagine a bee with smooth, slick hair. What might happen?",
        "choices": [
          "Less pollen would stick to it",
          "More fruit would grow",
          "It would make more nectar"
        ],
        "why": "Pollen sticks to a bee because its body is fuzzy."
      }
    ]
  },
  "episode:vid-neighborhood-map-quest": {
    "title": "The Neighborhood Map Quest",
    "subject": "reading",
    "k1": [
      {
        "q": "What is a landmark?",
        "choices": [
          "Something easy to spot",
          "Something hidden"
        ],
        "why": "A landmark is something easy to spot, like a park or a big tree."
      },
      {
        "q": "Which one is a landmark?",
        "choices": [
          "A big tree",
          "A tiny ant"
        ],
        "why": "A big tree is easy to spot, so it is a landmark."
      },
      {
        "q": "What was in Kiyah’s way?",
        "choices": [
          "A dog",
          "A river"
        ],
        "why": "A dog was in the way, so Kiyah found another route."
      },
      {
        "q": "Where was Kiyah going?",
        "choices": [
          "Averi’s house",
          "The moon"
        ],
        "why": "Kiyah used the map to find a route to Averi’s house."
      }
    ],
    "g23": [
      {
        "q": "The first way is blocked. What can a map help you find?",
        "choices": [
          "Another route",
          "A new friend",
          "A lost toy"
        ],
        "why": "A map shows the way, so you can find another route when the first one is blocked."
      },
      {
        "q": "Which of these could be a landmark on a map?",
        "choices": [
          "A school",
          "A cloud",
          "A sound"
        ],
        "why": "A landmark is something easy to spot, like a park, a big tree or a school."
      },
      {
        "q": "What two things on the map helped Kiyah find the way?",
        "choices": [
          "Streets and landmarks",
          "Stars and clouds",
          "Colors and songs"
        ],
        "why": "Kiyah followed the streets and landmarks on the map."
      },
      {
        "q": "Why is a park a good landmark?",
        "choices": [
          "It is easy to spot",
          "It moves around",
          "It is very small"
        ],
        "why": "A landmark is something easy to spot, like a park."
      }
    ],
    "g45": [
      {
        "q": "Why do maps show landmarks and not just streets?",
        "choices": [
          "Landmarks are easy to spot on the way",
          "Landmarks make the map heavier",
          "Maps never show streets"
        ],
        "why": "Landmarks are easy to spot, so they help you know where you are."
      },
      {
        "q": "A road is closed on your way to school. How can a map help?",
        "choices": [
          "It shows another route",
          "It opens the road",
          "It makes the trip shorter"
        ],
        "why": "A map lets you find another route when the first one is blocked."
      },
      {
        "q": "Which would make the best landmark on a map?",
        "choices": [
          "A tall water tower",
          "A parked car",
          "A puddle"
        ],
        "why": "A landmark is something easy to spot, like a park, a big tree or a school."
      },
      {
        "q": "In the story, why did Kiyah need a new route?",
        "choices": [
          "A dog was in the way",
          "The map was lost",
          "It started to rain"
        ],
        "why": "When a dog was in the way, Kiyah used the map to find another route."
      }
    ]
  },
  "episode:vide-mtk482jq-f": {
    "title": "KK's Ancient Pyramid",
    "subject": "engineering",
    "k1": [
      {
        "q": "What were the pyramids built from?",
        "choices": [
          "Big stone blocks",
          "Paper"
        ],
        "why": "The pyramids were built from large stone blocks."
      },
      {
        "q": "Where are these pyramids?",
        "choices": [
          "Egypt",
          "The moon"
        ],
        "why": "These are the pyramids of ancient Egypt."
      },
      {
        "q": "Is the Great Pyramid still standing today?",
        "choices": [
          "Yes",
          "No"
        ],
        "why": "The Great Pyramid was built long ago and is still standing today."
      },
      {
        "q": "What is a pharaoh?",
        "choices": [
          "A ruler",
          "A kind of boat"
        ],
        "why": "A pharaoh was a ruler of ancient Egypt."
      }
    ],
    "g23": [
      {
        "q": "Who were some pyramids built for?",
        "choices": [
          "Pharaohs",
          "Teachers",
          "Sailors"
        ],
        "why": "Some pyramids were built as tombs for pharaohs."
      },
      {
        "q": "About how long ago was the Great Pyramid built?",
        "choices": [
          "About 4,500 years ago",
          "About 45 years ago",
          "Last year"
        ],
        "why": "The Great Pyramid was built about 4,500 years ago."
      },
      {
        "q": "Some pyramids were built as what?",
        "choices": [
          "Tombs",
          "Schools",
          "Stores"
        ],
        "why": "Some pyramids were built as tombs for pharaohs."
      },
      {
        "q": "KK learns that a pharaoh was a ruler. A ruler of where?",
        "choices": [
          "Ancient Egypt",
          "A pirate ship",
          "A castle in the sky"
        ],
        "why": "A pharaoh was a ruler of ancient Egypt."
      }
    ],
    "g45": [
      {
        "q": "The Great Pyramid is about 4,500 years old. What does that show about stone?",
        "choices": [
          "Stone blocks can last a very long time",
          "Stone crumbles in a few years",
          "Stone is lighter than wood"
        ],
        "why": "Built from stone about 4,500 years ago, the Great Pyramid still stands."
      },
      {
        "q": "What job did some pyramids have?",
        "choices": [
          "Tombs for pharaohs",
          "Houses for farmers",
          "Lighthouses for ships"
        ],
        "why": "Some pyramids were built as tombs for pharaohs."
      },
      {
        "q": "What does “pharaoh” mean?",
        "choices": [
          "A ruler of ancient Egypt",
          "A pyramid builder’s tool",
          "A stone block",
          "A desert animal"
        ],
        "why": "A pharaoh was a ruler of ancient Egypt."
      },
      {
        "q": "How many 100-year spans fit into 4,500 years?",
        "choices": [
          "45",
          "4",
          "450"
        ],
        "why": "4,500 divided by 100 is 45."
      }
    ]
  },
  "episode:vide-mtu5apj2-a": {
    "title": "A Raindrop's Journey Through the Water Cycle",
    "subject": "science",
    "k1": [
      {
        "q": "What warms the puddle?",
        "choices": [
          "The sun",
          "The moon"
        ],
        "why": "The sun warms puddles."
      },
      {
        "q": "What falls from the clouds?",
        "choices": [
          "Rain",
          "Sand"
        ],
        "why": "When the drops in a cloud grow heavy, they fall as rain."
      },
      {
        "q": "Clouds are made of tiny...",
        "choices": [
          "Drops of water",
          "Bits of cotton"
        ],
        "why": "High in the sky, water cools into tiny drops that make clouds."
      },
      {
        "q": "Is the sky up high warm or cold?",
        "choices": [
          "Cold",
          "Hot"
        ],
        "why": "High in the cold sky, the water cools into clouds."
      }
    ],
    "g23": [
      {
        "q": "What happens to puddle water when the sun warms it?",
        "choices": [
          "Some turns into a gas",
          "It turns into ice",
          "It turns into sand"
        ],
        "why": "The sun turns some of the water into an invisible gas."
      },
      {
        "q": "What makes the drops in a cloud fall as rain?",
        "choices": [
          "They grow heavy",
          "The wind gets tired",
          "They turn warm"
        ],
        "why": "When the drops grow heavy, they fall as rain."
      },
      {
        "q": "What happens after the water gas rises into the cold sky?",
        "choices": [
          "It cools into clouds",
          "It falls as rain right away",
          "It turns into a puddle"
        ],
        "why": "High in the cold sky, it cools into tiny drops that make clouds."
      },
      {
        "q": "Can you see water when it becomes a gas?",
        "choices": [
          "No, it is invisible",
          "Yes, it is bright blue",
          "Yes, it looks like sand"
        ],
        "why": "The sun turns some of the water into an invisible gas."
      }
    ],
    "g45": [
      {
        "q": "Why is it called a water cycle?",
        "choices": [
          "Water rises, falls, then rises again",
          "New water is made in clouds",
          "The sun makes new water"
        ],
        "why": "Water evaporates, cools into clouds, and falls back down again as rain."
      },
      {
        "q": "What does “evaporate” mean in this episode?",
        "choices": [
          "Water turns into an invisible gas",
          "Water freezes into ice",
          "Water soaks into sand"
        ],
        "why": "When water evaporates, the sun turns it into an invisible gas."
      },
      {
        "q": "Why do clouds form high in the sky and not next to a warm puddle?",
        "choices": [
          "It is cold up high, so the gas cools",
          "Clouds need to be near the sun",
          "The ground pushes them up"
        ],
        "why": "High in the cold sky, the gas cools into tiny drops that make clouds."
      },
      {
        "q": "A puddle shrinks on a sunny day. Where did the water go?",
        "choices": [
          "Into the air as a gas",
          "Into the sun",
          "Deep underground forever"
        ],
        "why": "The sun warms puddles and turns some of the water into a gas."
      }
    ]
  },
  "episode:vide-mv4dzipw-5": {
    "title": "The History Time Machine",
    "subject": "reading",
    "k1": [
      {
        "q": "What helps a history lesson make sense?",
        "choices": [
          "Putting events in order",
          "Skipping to the end"
        ],
        "why": "Putting events in order helps a history lesson make sense."
      },
      {
        "q": "Putting events in order shows what happened...",
        "choices": [
          "First, next and last",
          "Only at the end"
        ],
        "why": "Putting events in order shows what happened first, next and last."
      },
      {
        "q": "Which is a good question to ask about history?",
        "choices": [
          "What changed?",
          "What is for lunch?"
        ],
        "why": "Asking “What changed?” helps a history lesson make sense."
      },
      {
        "q": "Can drawing events help you learn history?",
        "choices": [
          "Yes",
          "No"
        ],
        "why": "Drawing events in order helps a history lesson make sense."
      }
    ],
    "g23": [
      {
        "q": "Which two questions help history make sense?",
        "choices": [
          "What changed? Why did it matter?",
          "What color? How tall?",
          "Who is hungry? Who is tired?"
        ],
        "why": "Asking what changed and why it mattered helps history make sense."
      },
      {
        "q": "Why put events in order?",
        "choices": [
          "To see what came first, next, last",
          "To make the story longer",
          "To hide the ending"
        ],
        "why": "Putting events in order shows what happened first, next and last."
      },
      {
        "q": "Asking why something mattered connects the past to what?",
        "choices": [
          "The world today",
          "Outer space",
          "A bedtime dream"
        ],
        "why": "Asking why something mattered connects the past to the world we live in today."
      },
      {
        "q": "You draw three pictures of a town long ago. What should you do with them?",
        "choices": [
          "Put them in order",
          "Mix them up",
          "Hide one away"
        ],
        "why": "Drawing events in order shows what happened first, next and last."
      }
    ],
    "g45": [
      {
        "q": "How does asking “Why did it matter?” help you?",
        "choices": [
          "It links the past to life today",
          "It tells you the exact date",
          "It makes the event shorter"
        ],
        "why": "Asking why something mattered connects the past to the world we live in today."
      },
      {
        "q": "A timeline puts events in order. What does it show?",
        "choices": [
          "What happened first, next and last",
          "Who was the tallest",
          "What will happen next year"
        ],
        "why": "Putting events in order shows what happened first, next and last."
      },
      {
        "q": "After learning about an event, which question best checks its effect?",
        "choices": [
          "What changed?",
          "What time is it?",
          "Who drew this?"
        ],
        "why": "Asking “What changed?” shows how an event made a difference."
      },
      {
        "q": "Which study plan fits the episode best?",
        "choices": [
          "Draw events in order, then ask why",
          "Memorize dates with no pictures",
          "Read only the ending"
        ],
        "why": "Drawing events in order and asking why they mattered helps history make sense."
      }
    ]
  },
  "activity:act-audiobook": {
    "title": "Record Your Own Audiobook",
    "subject": "reading",
    "k1": [
      {
        "q": "Can your voice change how a story feels?",
        "choices": [
          "Yes",
          "No"
        ],
        "why": "How fast, how loud and where you pause all change how a listener feels."
      },
      {
        "q": "Before a surprise, should you read slow or fast?",
        "choices": [
          "Slow",
          "Fast"
        ],
        "why": "Slowing down right before a surprise makes the surprise land."
      },
      {
        "q": "Does a pause in your reading matter?",
        "choices": [
          "Yes, it changes the feeling",
          "No, it does nothing"
        ],
        "why": "Where you pause changes how a listener feels."
      },
      {
        "q": "Which is one way to change your voice?",
        "choices": [
          "Loud or soft",
          "Red or blue"
        ],
        "why": "How loud you read changes how a listener feels."
      }
    ],
    "g23": [
      {
        "q": "Which three things change how a listener feels?",
        "choices": [
          "Speed, loudness and pauses",
          "Paper, pencils and pens",
          "Shoes, hats and socks"
        ],
        "why": "How fast, how loud and where you pause all change how a listener feels."
      },
      {
        "q": "Why slow down right before a surprise?",
        "choices": [
          "It makes the surprise land",
          "It makes the story shorter",
          "It hides the surprise"
        ],
        "why": "Slowing down right before a surprise makes the surprise land."
      },
      {
        "q": "You are reading a spooky part. What could make it feel spookier?",
        "choices": [
          "A quiet voice and a pause",
          "Reading super fast",
          "Skipping that page"
        ],
        "why": "How loud you read and where you pause change how a listener feels."
      },
      {
        "q": "When you record an audiobook, who feels the story?",
        "choices": [
          "The listener",
          "The microphone",
          "The book cover"
        ],
        "why": "Your voice changes how a listener feels."
      }
    ],
    "g45": [
      {
        "q": "A reader rushes right through the surprise. What likely happens?",
        "choices": [
          "The surprise does not land as well",
          "The surprise feels bigger",
          "The listener reads along faster"
        ],
        "why": "Slowing down before a surprise is what makes it land."
      },
      {
        "q": "Which choice best builds suspense before a big reveal?",
        "choices": [
          "Slow down and pause",
          "Speed up and shout",
          "Read in one flat tone"
        ],
        "why": "Slowing down and pausing right before a surprise makes it land."
      },
      {
        "q": "What is the main idea of recording an audiobook?",
        "choices": [
          "Voice choices shape how listeners feel",
          "Only the words matter",
          "Loud reading is always best"
        ],
        "why": "How fast, how loud and where you pause all change how a listener feels."
      },
      {
        "q": "Where you pause in a sentence can change what?",
        "choices": [
          "How the listener feels",
          "The spelling of the words",
          "The length of the book"
        ],
        "why": "Where you pause changes how a listener feels."
      }
    ]
  },
  "activity:act-ballet-stage": {
    "title": "The Story Stage",
    "subject": "art",
    "k1": [
      {
        "q": "Can you tell a story with no words?",
        "choices": [
          "Yes, by moving",
          "No, never"
        ],
        "why": "Bodies can tell stories without words."
      },
      {
        "q": "Who tells stories by moving?",
        "choices": [
          "Dancers",
          "Rocks"
        ],
        "why": "Actors and dancers show feelings and actions with how they move."
      },
      {
        "q": "What can dancers show with their moves?",
        "choices": [
          "Feelings",
          "Phone numbers"
        ],
        "why": "Dancers show feelings with how they move."
      },
      {
        "q": "Can an audience follow a story from moves alone?",
        "choices": [
          "Yes",
          "No"
        ],
        "why": "An audience can follow a whole story from movement alone."
      }
    ],
    "g23": [
      {
        "q": "Which are ways a dancer can change a move?",
        "choices": [
          "Fast or slow, big or small",
          "Loud or quiet words",
          "Red or blue paint"
        ],
        "why": "Movers can go fast or slow, big or small, high or low."
      },
      {
        "q": "What do actors and dancers use to show actions?",
        "choices": [
          "How their bodies move",
          "Long speeches",
          "Written signs"
        ],
        "why": "Actors and dancers show feelings and actions with how they move."
      },
      {
        "q": "An actor creeps slowly with small steps. What could that show?",
        "choices": [
          "Sneaking quietly",
          "Winning a race",
          "Jumping for joy"
        ],
        "why": "Slow, small moves can show an action like sneaking."
      },
      {
        "q": "Can an audience follow a story when nobody talks?",
        "choices": [
          "Yes, from movement alone",
          "No, they need words",
          "Only if there is a book"
        ],
        "why": "An audience can follow a whole story from movement alone."
      }
    ],
    "g45": [
      {
        "q": "A dancer moves low and slow, then high and fast. What is changing?",
        "choices": [
          "The feeling the moves show",
          "The words of the story",
          "The size of the stage"
        ],
        "why": "How you move, fast or slow, high or low, shows different feelings."
      },
      {
        "q": "Why can a ballet tell a story without any speaking?",
        "choices": [
          "Movement shows feelings and actions",
          "The audience reads a script",
          "The music says the words"
        ],
        "why": "Dancers show feelings and actions with how they move."
      },
      {
        "q": "To show a character feeling tiny and scared, which moves fit best?",
        "choices": [
          "Small and low",
          "Big and high",
          "Fast and wide"
        ],
        "why": "Big or small, high or low moves show different feelings."
      },
      {
        "q": "Which three pairs describe how bodies can move in a story?",
        "choices": [
          "Fast/slow, big/small, high/low",
          "Hot/cold, wet/dry, loud/soft",
          "Left/right only"
        ],
        "why": "Actors and dancers move fast or slow, big or small, high or low."
      }
    ]
  },
  "activity:act-book-portal-submarine": {
    "title": "The Library Book Portal Submarine",
    "subject": "science",
    "k1": [
      {
        "q": "How many hearts does an octopus have?",
        "choices": [
          "Three",
          "One"
        ],
        "why": "An octopus has three hearts."
      },
      {
        "q": "Would an octopus usually rather crawl or swim?",
        "choices": [
          "Crawl",
          "Swim"
        ],
        "why": "Octopuses would usually rather crawl."
      },
      {
        "q": "Where does an octopus’s blood pick up oxygen?",
        "choices": [
          "The gills",
          "The arms"
        ],
        "why": "Blood picks up oxygen at the gills."
      },
      {
        "q": "What stops when an octopus swims?",
        "choices": [
          "One of its hearts",
          "Its eyes"
        ],
        "why": "When an octopus swims, its third heart stops."
      }
    ],
    "g23": [
      {
        "q": "How many octopus hearts push blood to the gills?",
        "choices": [
          "Two",
          "One",
          "Three"
        ],
        "why": "Two hearts push blood to the gills."
      },
      {
        "q": "What does the blood pick up at the gills?",
        "choices": [
          "Oxygen",
          "Sand",
          "Salt"
        ],
        "why": "At the gills, the blood picks up oxygen."
      },
      {
        "q": "What does the third heart do?",
        "choices": [
          "Pushes blood to the rest of the body",
          "Pushes blood to the gills",
          "Helps the octopus see"
        ],
        "why": "The third heart pushes blood round the rest of the body."
      },
      {
        "q": "Why might an octopus crawl instead of swim?",
        "choices": [
          "Swimming stops its third heart",
          "It has no arms",
          "Crawling is faster"
        ],
        "why": "When an octopus swims, the third heart stops, which is one reason it would rather crawl."
      }
    ],
    "g45": [
      {
        "q": "Which heart stops when an octopus swims?",
        "choices": [
          "The one for the rest of the body",
          "Both gill hearts",
          "All three hearts"
        ],
        "why": "The third heart, which pushes blood round the body, stops when it swims."
      },
      {
        "q": "Why are the gills important to an octopus?",
        "choices": [
          "Blood picks up oxygen there",
          "They help it see",
          "They pump blood to its arms"
        ],
        "why": "Two hearts push blood to the gills, where it picks up oxygen."
      },
      {
        "q": "How do an octopus’s hearts split up the work?",
        "choices": [
          "Two serve the gills, one the body",
          "Two serve the arms, one the eyes",
          "All three serve the gills"
        ],
        "why": "Two hearts push blood to the gills and the third pushes it round the body."
      },
      {
        "q": "An octopus needs to travel across the sea floor. How would it rather move?",
        "choices": [
          "Crawling",
          "Swimming",
          "Floating"
        ],
        "why": "Swimming stops the third heart, so octopuses would usually rather crawl."
      }
    ]
  },
  "activity:act-cardboard-city": {
    "title": "The Cardboard City Rescue",
    "subject": "engineering",
    "k1": [
      {
        "q": "Which shape stays strong when you push it?",
        "choices": [
          "Triangle",
          "Square"
        ],
        "why": "Push on a triangle and it stays a triangle."
      },
      {
        "q": "What happens when you push on a square?",
        "choices": [
          "It squashes",
          "It stays the same"
        ],
        "why": "Push on a square and it squashes into a slant."
      },
      {
        "q": "Where do you see lots of triangles?",
        "choices": [
          "Bridges and roofs",
          "Puddles"
        ],
        "why": "Bridges and roofs are full of triangles."
      },
      {
        "q": "Chike needs a strong roof. Which shape should Chike use?",
        "choices": [
          "Triangles",
          "Squares"
        ],
        "why": "Triangles hold their shape under pressure."
      }
    ],
    "g23": [
      {
        "q": "What does a square turn into when you push it?",
        "choices": [
          "A slant",
          "A circle",
          "A triangle"
        ],
        "why": "Push on a square and it squashes into a slant."
      },
      {
        "q": "Why do builders put triangles in bridges?",
        "choices": [
          "Triangles hold their shape",
          "Triangles are prettier",
          "Triangles weigh nothing"
        ],
        "why": "Triangles hold their shape under pressure."
      },
      {
        "q": "You push on a triangle made of sticks. What happens?",
        "choices": [
          "It stays a triangle",
          "It turns into a square",
          "It folds flat"
        ],
        "why": "Push on a triangle and it stays a triangle."
      },
      {
        "q": "A cardboard tower wobbles. What could make it steadier?",
        "choices": [
          "Adding triangle braces",
          "Adding more squares",
          "Taking off the corners"
        ],
        "why": "Triangles hold their shape, so they make a frame steady."
      }
    ],
    "g45": [
      {
        "q": "Why can’t a triangle’s corners move when you push it?",
        "choices": [
          "A side would have to change length",
          "Triangles are made of metal",
          "Its corners are glued tighter"
        ],
        "why": "None of its corners can move without one of its sides changing length."
      },
      {
        "q": "Why does a square frame squash under pressure?",
        "choices": [
          "Its corners shift; sides stay the same",
          "Its sides stretch longer",
          "It has too few corners"
        ],
        "why": "A square’s corners can move without any side changing length, so it slants."
      },
      {
        "q": "A builder adds a diagonal stick across a square gate. Why?",
        "choices": [
          "It makes triangles that hold their shape",
          "It makes the gate lighter",
          "It adds a fifth side"
        ],
        "why": "A diagonal splits the square into triangles, which hold their shape."
      },
      {
        "q": "Why are roofs and bridges full of triangles?",
        "choices": [
          "They keep their shape under pressure",
          "They are cheaper than squares",
          "They keep the rain off"
        ],
        "why": "Triangles hold their shape under pressure, so bridges and roofs use them."
      }
    ]
  },
  "activity:act-clay-volcano": {
    "title": "Make a Clay Volcano",
    "subject": "science",
    "k1": [
      {
        "q": "Is lava hot or cold?",
        "choices": [
          "Hot",
          "Cold"
        ],
        "why": "Lava is rock so hot that it melted."
      },
      {
        "q": "Lava comes from...",
        "choices": [
          "Under the ground",
          "The clouds"
        ],
        "why": "Lava is melted rock from beneath the surface."
      },
      {
        "q": "Is magma thick or thin like water?",
        "choices": [
          "Thick",
          "Thin like water"
        ],
        "why": "Hot rock turns into a thick liquid called magma."
      },
      {
        "q": "Lava cools and turns into...",
        "choices": [
          "Hard new rock",
          "Soft clay"
        ],
        "why": "Lava cools down and hardens into new rock."
      }
    ],
    "g23": [
      {
        "q": "What is the thick, melted rock under the ground called?",
        "choices": [
          "Magma",
          "Mud",
          "Lava"
        ],
        "why": "Deep underground, melted rock is a thick liquid called magma."
      },
      {
        "q": "How does magma get out of the ground?",
        "choices": [
          "Through a volcano",
          "Through tree roots",
          "Through rain clouds"
        ],
        "why": "Magma finds a way out through a volcano."
      },
      {
        "q": "Why does rock deep underground turn into a liquid?",
        "choices": [
          "It gets very hot",
          "It gets wet",
          "It gets squished flat"
        ],
        "why": "Deep under the ground, rock gets so hot that it turns into a thick liquid."
      },
      {
        "q": "What happens to lava over time?",
        "choices": [
          "It cools and hardens",
          "It turns into steam",
          "It sinks back down"
        ],
        "why": "Lava cools down and hardens into new rock."
      }
    ],
    "g45": [
      {
        "q": "Magma and lava are the same melted rock. What changes its name?",
        "choices": [
          "Coming out through a volcano",
          "Getting colder underground",
          "Mixing with water"
        ],
        "why": "When magma finds a way out through a volcano, we call it lava."
      },
      {
        "q": "How can a volcano make new land over time?",
        "choices": [
          "Lava hardens into new rock",
          "It pulls rock down from the sky",
          "Magma turns into sand"
        ],
        "why": "Lava cools down and hardens into new rock."
      },
      {
        "q": "Which words best describe magma?",
        "choices": [
          "A thick liquid",
          "A light gas",
          "A hard solid",
          "A thin powder"
        ],
        "why": "Hot rock turns into a thick liquid called magma."
      },
      {
        "q": "Where does the rock in lava first come from?",
        "choices": [
          "Deep under the ground",
          "The top of a mountain",
          "Sand on the beach"
        ],
        "why": "Lava is melted rock from deep beneath the surface."
      }
    ]
  },
  "activity:act-color-drawing": {
    "title": "Color Your Own Drawing",
    "subject": "art",
    "k1": [
      {
        "q": "What do artists put down first?",
        "choices": [
          "Flat colors",
          "Shadows"
        ],
        "why": "Artists lay down flat colors first."
      },
      {
        "q": "Do artists paint everything at once?",
        "choices": [
          "No, in layers",
          "Yes, all at once"
        ],
        "why": "Painters work in layers."
      },
      {
        "q": "Shadows go on a layer that is...",
        "choices": [
          "On top",
          "Underneath"
        ],
        "why": "Shadows and light go on separate layers on top."
      },
      {
        "q": "With layers, can you fix one part and keep the rest?",
        "choices": [
          "Yes",
          "No"
        ],
        "why": "Each part can be changed without spoiling the rest."
      }
    ],
    "g23": [
      {
        "q": "In what order do digital artists usually work?",
        "choices": [
          "Flat colors, then shadows and light",
          "Shadows, then flat colors",
          "Light, then the flat colors"
        ],
        "why": "They lay down flat colors first, then add shadows and light."
      },
      {
        "q": "Why put shadows on a separate layer?",
        "choices": [
          "You can change it and keep the rest",
          "It makes colors brighter",
          "It saves paper"
        ],
        "why": "Separate layers let each part change without spoiling the rest."
      },
      {
        "q": "Layers help a pencil drawing turn into what?",
        "choices": [
          "A picture that looks finished",
          "A blank page",
          "A paper plane"
        ],
        "why": "Layers are how a pencil drawing turns into a picture that looks finished."
      },
      {
        "q": "You color a cat, then add light on a new layer. Where is the light layer?",
        "choices": [
          "On top",
          "Underneath",
          "Beside it"
        ],
        "why": "Shadows and light go on separate layers on top."
      }
    ],
    "g45": [
      {
        "q": "An artist dislikes the shadows. With layers, what can the artist do?",
        "choices": [
          "Change just the shadow layer",
          "Start the whole picture over",
          "Erase the flat colors"
        ],
        "why": "Each part can be changed without spoiling the rest."
      },
      {
        "q": "Why do digital artists rarely paint everything at once?",
        "choices": [
          "Layers let each part change on its own",
          "Screens show only one color",
          "Painting at once is too slow"
        ],
        "why": "Separate layers let each part be changed without spoiling the rest."
      },
      {
        "q": "Which layer plan matches how artists work?",
        "choices": [
          "Flat colors below, shading above",
          "Shadows below, colors above",
          "Everything on one layer"
        ],
        "why": "Flat colors go down first, with shadows and light on layers on top."
      },
      {
        "q": "What do light and shadow layers do for a flat-colored drawing?",
        "choices": [
          "Make it look finished",
          "Hide the drawing",
          "Turn it black and white"
        ],
        "why": "Adding shadows and light is how a drawing turns into a finished-looking picture."
      }
    ]
  },
  "activity:act-computer-story": {
    "title": "Type and Illustrate Your Own Story",
    "subject": "reading",
    "k1": [
      {
        "q": "Do real writers get it right the first time?",
        "choices": [
          "No, they fix it",
          "Yes, always"
        ],
        "why": "Real writers don’t get it right the first time."
      },
      {
        "q": "What do writers do first?",
        "choices": [
          "Plan",
          "Fix"
        ],
        "why": "Writers plan, write, then fix."
      },
      {
        "q": "Why is typing handy for fixing?",
        "choices": [
          "You can change a word easily",
          "It writes for you"
        ],
        "why": "Typing lets you change a word without starting over."
      },
      {
        "q": "After writing, what should you do?",
        "choices": [
          "Read it back",
          "Throw it away"
        ],
        "why": "Writers read their draft back to fix what is unclear."
      }
    ],
    "g23": [
      {
        "q": "What are the three steps writers use?",
        "choices": [
          "Plan, write, fix",
          "Fix, plan, write",
          "Write, stop, hide"
        ],
        "why": "Writers plan, write, then fix."
      },
      {
        "q": "How should a first draft be written?",
        "choices": [
          "Fast",
          "Perfectly",
          "One word a day"
        ],
        "why": "Writers write a fast first draft, then fix it."
      },
      {
        "q": "Why read your story back?",
        "choices": [
          "To find what is unclear",
          "To make it longer",
          "To count the pages"
        ],
        "why": "Writers read it back to fix what is unclear."
      },
      {
        "q": "You typed the wrong word. What can you do?",
        "choices": [
          "Change just that word",
          "Start the whole story over",
          "Leave it forever"
        ],
        "why": "Typing lets you change a word without starting over."
      }
    ],
    "g45": [
      {
        "q": "Why write a fast first draft instead of a perfect one?",
        "choices": [
          "You fix it later, so get ideas down",
          "Fast drafts never need fixing",
          "Readers only like fast drafts"
        ],
        "why": "Writers write a fast first draft, then read it back to fix it."
      },
      {
        "q": "A sentence confuses your reader. Which step handles that?",
        "choices": [
          "Fixing",
          "Planning",
          "Illustrating"
        ],
        "why": "Writers read back and fix what is unclear."
      },
      {
        "q": "How does typing make fixing easier than handwriting?",
        "choices": [
          "Change words without starting over",
          "It spells every word for you",
          "It plans the story for you"
        ],
        "why": "Typing lets you change a word without starting over."
      },
      {
        "q": "Which order do real writers follow?",
        "choices": [
          "Plan, fast draft, read back and fix",
          "Fix, plan, then draft",
          "Draft once and stop"
        ],
        "why": "Writers plan, write a fast first draft, then read it back to fix it."
      }
    ]
  },
  "activity:act-coral-reef": {
    "title": "Coral Reef Drawing",
    "subject": "science",
    "k1": [
      {
        "q": "What builds a coral reef?",
        "choices": [
          "Tiny animals",
          "Big rocks"
        ],
        "why": "A reef is built by tiny living animals called coral polyps."
      },
      {
        "q": "What does a reef give sea animals?",
        "choices": [
          "Food and shelter",
          "Toys"
        ],
        "why": "Coral reefs give sea animals food and shelter."
      },
      {
        "q": "Where can fish hide on a reef?",
        "choices": [
          "In the branches and gaps",
          "In the open sky"
        ],
        "why": "The branches and gaps make hiding places."
      },
      {
        "q": "Is coral alive?",
        "choices": [
          "Yes",
          "No"
        ],
        "why": "Coral polyps are tiny living animals."
      }
    ],
    "g23": [
      {
        "q": "What are the tiny animals that build reefs called?",
        "choices": [
          "Coral polyps",
          "Sea stars",
          "Jellyfish"
        ],
        "why": "A reef is built by tiny living animals called coral polyps."
      },
      {
        "q": "Why do so many creatures live on a reef?",
        "choices": [
          "It has hiding places and food",
          "The water is warmer",
          "Reefs keep sharks away"
        ],
        "why": "The branches and gaps make hiding places and feeding grounds."
      },
      {
        "q": "Where would you find more kinds of creatures?",
        "choices": [
          "On a small patch of reef",
          "In the open water nearby",
          "They are the same"
        ],
        "why": "A small patch of reef can hold more kinds of creature than the open water around it."
      },
      {
        "q": "What do the gaps in a reef make?",
        "choices": [
          "Hiding places",
          "Bubbles",
          "Waves"
        ],
        "why": "All those branches and gaps make hiding places."
      }
    ],
    "g45": [
      {
        "q": "Why can a small reef hold more kinds of life than open water?",
        "choices": [
          "Its branches give food and shelter",
          "Open water has no food at all",
          "Reefs are colder"
        ],
        "why": "The reef’s branches and gaps make hiding places and feeding grounds."
      },
      {
        "q": "What would happen to reef fish if the coral polyps disappeared?",
        "choices": [
          "They would lose food and shelter",
          "They would get more hiding places",
          "Nothing would change"
        ],
        "why": "The coral polyps build the reef that gives sea animals food and shelter."
      },
      {
        "q": "Which describes a coral reef best?",
        "choices": [
          "Built by tiny living animals",
          "Made of plain stone",
          "Made by people"
        ],
        "why": "A reef is built by tiny living animals called coral polyps."
      },
      {
        "q": "A small fish is chased by a bigger fish. How does the reef help?",
        "choices": [
          "It can hide in the gaps",
          "The reef chases the big fish",
          "The reef makes it swim faster"
        ],
        "why": "The reef’s branches and gaps make hiding places."
      }
    ]
  },
  "activity:act-family-flag": {
    "title": "The Family Flag",
    "subject": "art",
    "k1": [
      {
        "q": "Can a shape on a flag mean something?",
        "choices": [
          "Yes",
          "No"
        ],
        "why": "A shape on a flag can stand for an idea, a place or a promise."
      },
      {
        "q": "Does a symbol need words?",
        "choices": [
          "No",
          "Yes, lots"
        ],
        "why": "Symbols carry meaning without words."
      },
      {
        "q": "Which is faster to read?",
        "choices": [
          "A symbol",
          "A long sentence"
        ],
        "why": "Once people agree what a symbol means, it works faster than a sentence."
      },
      {
        "q": "What can a flag shape stand for?",
        "choices": [
          "An idea or a place",
          "Nothing at all"
        ],
        "why": "A shape on a flag can stand for an idea, a place or a promise."
      }
    ],
    "g23": [
      {
        "q": "What three things can a flag shape stand for?",
        "choices": [
          "An idea, a place, a promise",
          "A sound, a smell, a taste",
          "A number, a song, a game"
        ],
        "why": "A shape on a flag can stand for an idea, a place or a promise."
      },
      {
        "q": "When does a symbol work faster than a sentence?",
        "choices": [
          "When people agree what it means",
          "When it is very big",
          "When it has many colors"
        ],
        "why": "Once people agree what a symbol means, it works faster than a sentence."
      },
      {
        "q": "What is a symbol?",
        "choices": [
          "A shape that stands for something",
          "A long sentence",
          "A kind of paint"
        ],
        "why": "A symbol is a shape that stands for an idea, a place or a promise."
      },
      {
        "q": "Your family picks a tree to mean “we grow together.” What is the tree?",
        "choices": [
          "A symbol",
          "A sentence",
          "A map"
        ],
        "why": "A shape that stands for an idea is a symbol."
      }
    ],
    "g45": [
      {
        "q": "Why must people agree on what a symbol means?",
        "choices": [
          "So it means the same to everyone",
          "So it can be drawn bigger",
          "So it uses more words"
        ],
        "why": "Once people agree what a symbol means, it works faster than a sentence."
      },
      {
        "q": "Why might a flag use a symbol and not a sentence?",
        "choices": [
          "It shares the meaning faster",
          "Sentences can’t go on cloth",
          "Symbols cost less paint"
        ],
        "why": "A symbol people agree on works faster than a sentence."
      },
      {
        "q": "A star on your flag means a promise to try hard. What is the star doing?",
        "choices": [
          "Carrying meaning without words",
          "Telling a story in words",
          "Showing the weather"
        ],
        "why": "Symbols carry meaning without words."
      },
      {
        "q": "A visitor sees your flag and doesn’t know what the shapes mean. Why?",
        "choices": [
          "They haven’t learned what they stand for",
          "Symbols never have meaning",
          "Flags must use words"
        ],
        "why": "A symbol only works once people know and agree what it means."
      }
    ]
  },
  "activity:act-flipbook-movie": {
    "title": "Make a Camera Flip-Book Movie",
    "subject": "technology",
    "k1": [
      {
        "q": "What is a movie made of?",
        "choices": [
          "Still pictures",
          "Moving paint"
        ],
        "why": "Every movie is a string of still pictures."
      },
      {
        "q": "Shown fast, still pictures look like they...",
        "choices": [
          "Move",
          "Vanish"
        ],
        "why": "When still pictures flash by quickly, your brain joins them into movement."
      },
      {
        "q": "Are cartoons made of pictures too?",
        "choices": [
          "Yes",
          "No"
        ],
        "why": "Every cartoon is a string of still pictures."
      },
      {
        "q": "Small changes between pictures make the motion...",
        "choices": [
          "Smooth",
          "Jumpy"
        ],
        "why": "Smaller changes between pictures make smoother motion."
      }
    ],
    "g23": [
      {
        "q": "What joins still pictures into movement?",
        "choices": [
          "Your brain",
          "The paper",
          "The camera’s light"
        ],
        "why": "When pictures flash by quickly, your brain joins them into movement."
      },
      {
        "q": "Your flip-book looks jumpy. What could help?",
        "choices": [
          "Smaller changes between pictures",
          "Bigger changes between pictures",
          "Fewer pictures"
        ],
        "why": "Smaller changes between pictures make smoother motion."
      },
      {
        "q": "How must still pictures be shown to look like a movie?",
        "choices": [
          "Quickly, one after another",
          "Slowly, one each day",
          "All at the same time"
        ],
        "why": "When still pictures flash by quickly, they look like movement."
      },
      {
        "q": "You flip your flip-book very slowly. What do you see?",
        "choices": [
          "Separate still pictures",
          "Smooth movement",
          "A blank page"
        ],
        "why": "Pictures only join into movement when they flash by quickly."
      }
    ],
    "g45": [
      {
        "q": "Why does a flip-book seem to move when you flip it fast?",
        "choices": [
          "The brain joins quick pictures",
          "The ink moves on the page",
          "The paper bends the picture"
        ],
        "why": "When still pictures flash by quickly, your brain joins them into movement."
      },
      {
        "q": "A ball moves 1 inch per page or 5 inches per page. Which looks smoother?",
        "choices": [
          "1 inch per page",
          "5 inches per page",
          "Both look the same"
        ],
        "why": "Smaller changes between pictures make smoother motion."
      },
      {
        "q": "What is every movie really made of?",
        "choices": [
          "A string of still pictures",
          "One long moving picture",
          "Many sounds"
        ],
        "why": "Every cartoon and movie is a string of still pictures."
      },
      {
        "q": "An animator wants a slow, smooth walk. What should they draw?",
        "choices": [
          "Many pictures with small changes",
          "A few pictures with big jumps",
          "One picture, shaken"
        ],
        "why": "Smaller changes between pictures make smoother motion."
      }
    ]
  },
  "activity:act-garden-map": {
    "title": "How to Draw a Bee",
    "subject": "science",
    "k1": [
      {
        "q": "What sticks to a bee when it lands to feed?",
        "choices": [
          "Pollen",
          "Paint"
        ],
        "why": "When a bee lands to feed, pollen sticks to its body."
      },
      {
        "q": "Does a bee mean to carry pollen?",
        "choices": [
          "No",
          "Yes"
        ],
        "why": "The bee carries pollen to the next flower without meaning to."
      },
      {
        "q": "What do many plants make with a bee’s help?",
        "choices": [
          "Seeds",
          "Stones"
        ],
        "why": "Bees moving pollen is how many plants make seeds."
      },
      {
        "q": "Bees help keep a garden...",
        "choices": [
          "Growing",
          "Sleeping"
        ],
        "why": "A small visitor doing a small job keeps a whole garden growing."
      }
    ],
    "g23": [
      {
        "q": "Why does a bee land on a flower?",
        "choices": [
          "To feed",
          "To carry seeds home",
          "To build a nest"
        ],
        "why": "A bee lands on a flower to feed."
      },
      {
        "q": "Where does the bee take the pollen?",
        "choices": [
          "To the next flower",
          "Back up to the sky",
          "Into the soil"
        ],
        "why": "The bee carries pollen to the next flower."
      },
      {
        "q": "The bee moves pollen without meaning to. What does that help plants do?",
        "choices": [
          "Make seeds",
          "Grow leaves",
          "Change color"
        ],
        "why": "Moving pollen from flower to flower is how many plants make seeds."
      },
      {
        "q": "How can a small bee help a whole garden?",
        "choices": [
          "Its small job helps plants make seeds",
          "It eats the weeds",
          "It waters the plants"
        ],
        "why": "A small visitor doing a small job keeps a whole garden growing."
      }
    ],
    "g45": [
      {
        "q": "Why can we say the bee helps flowers by accident?",
        "choices": [
          "It only came to feed",
          "It drops pollen on purpose",
          "It never touches flowers"
        ],
        "why": "The bee lands to feed and carries pollen without meaning to."
      },
      {
        "q": "What would a garden lose without bee visitors?",
        "choices": [
          "Many plants could not make seeds",
          "The flowers would grow taller",
          "The soil would turn to sand"
        ],
        "why": "Bees moving pollen is how many plants make seeds."
      },
      {
        "q": "How does pollen get from one flower to another?",
        "choices": [
          "It sticks to a bee and rides along",
          "The flower throws it",
          "Rain washes it up"
        ],
        "why": "Pollen sticks to the bee’s body, and the bee carries it to the next flower."
      },
      {
        "q": "What is the big idea of “a small visitor doing a small job”?",
        "choices": [
          "Small helpers can keep a garden growing",
          "Bees are too small to matter",
          "Only big animals help plants"
        ],
        "why": "A small visitor doing a small job keeps a whole garden growing."
      }
    ]
  },
  "activity:act-line-dance": {
    "title": "The Country Line-Dance",
    "subject": "technology",
    "k1": [
      {
        "q": "A sequence is steps in a...",
        "choices": [
          "Set order",
          "Mixed-up pile"
        ],
        "why": "A sequence is a set of steps in a fixed order."
      },
      {
        "q": "If you change the order, is it the same dance?",
        "choices": [
          "No, it is different",
          "Yes, the same"
        ],
        "why": "Change the order and it becomes a different dance."
      },
      {
        "q": "Can anybody learn a dance with named steps?",
        "choices": [
          "Yes",
          "No"
        ],
        "why": "Once you name the steps and fix the order, anybody can learn it."
      },
      {
        "q": "When everyone follows the steps, where do they end up?",
        "choices": [
          "The same place",
          "Different places"
        ],
        "why": "Following the same sequence, everybody ends up in the same place."
      }
    ],
    "g23": [
      {
        "q": "What is a sequence?",
        "choices": [
          "Steps in a fixed order",
          "One big jump",
          "Steps in any order"
        ],
        "why": "A sequence is a set of steps in a fixed order."
      },
      {
        "q": "What happens if you swap two steps in the dance?",
        "choices": [
          "It becomes a different dance",
          "Nothing changes",
          "The music stops"
        ],
        "why": "Change the order and it becomes a different dance."
      },
      {
        "q": "Why give each step a name?",
        "choices": [
          "So anybody can learn it",
          "So the dance is longer",
          "So nobody can copy it"
        ],
        "why": "Once you name the steps and fix the order, anybody can learn it."
      },
      {
        "q": "Why does everybody end up in the same place?",
        "choices": [
          "They all follow the same order",
          "They all start late",
          "They all move at random"
        ],
        "why": "With a fixed order of steps, everybody ends up in the same place."
      }
    ],
    "g45": [
      {
        "q": "What two things make a sequence teachable?",
        "choices": [
          "Naming the steps and fixing the order",
          "Fast music and bright lights",
          "Big moves and loud claps"
        ],
        "why": "Once you name the steps and fix the order, anybody can learn it."
      },
      {
        "q": "Steps A, B, C and steps C, B, A. Are they the same sequence?",
        "choices": [
          "No, the order changed",
          "Yes, same steps",
          "Only if done fast"
        ],
        "why": "Change the order and it becomes a different sequence."
      },
      {
        "q": "A recipe says mix, bake, then frost. Why is this a sequence?",
        "choices": [
          "It is steps in a fixed order",
          "It uses food",
          "It has three words"
        ],
        "why": "A sequence is a set of steps in a fixed order."
      },
      {
        "q": "A dancer does the right steps in the wrong order. What happens?",
        "choices": [
          "They end up somewhere different",
          "They end up in the same place",
          "The steps disappear"
        ],
        "why": "Change the order and it becomes a different dance."
      }
    ]
  },
  "activity:act-marble-run": {
    "title": "The Bottle-Cap Marble Run",
    "subject": "science",
    "k1": [
      {
        "q": "Which ramp makes a marble roll faster?",
        "choices": [
          "A steep ramp",
          "A gentle ramp"
        ],
        "why": "A steeper ramp gives a faster roll."
      },
      {
        "q": "Which way does gravity pull?",
        "choices": [
          "Down",
          "Up"
        ],
        "why": "Gravity pulls straight down."
      },
      {
        "q": "A gentle ramp makes the trip...",
        "choices": [
          "Longer and slower",
          "Shorter and faster"
        ],
        "why": "A gentle ramp turns the drop into a longer, slower journey."
      },
      {
        "q": "Does gravity ever stop pulling?",
        "choices": [
          "No, it pulls all the time",
          "Yes, at night"
        ],
        "why": "Gravity pulls straight down all the time."
      }
    ],
    "g23": [
      {
        "q": "Why does a marble go faster on a steep ramp?",
        "choices": [
          "More of gravity’s pull speeds it up",
          "Steep ramps are smoother",
          "The marble gets heavier"
        ],
        "why": "A steep ramp lets more of gravity’s pull go into speeding the marble along."
      },
      {
        "q": "You want a slow marble run. What ramp should you build?",
        "choices": [
          "A gentle ramp",
          "A steep ramp",
          "A straight-down drop"
        ],
        "why": "A gentle ramp makes a longer, slower journey."
      },
      {
        "q": "What pulls the marble down the ramp?",
        "choices": [
          "Gravity",
          "Wind",
          "Magnets"
        ],
        "why": "Gravity pulls straight down all the time."
      },
      {
        "q": "Two ramps start at the same height. Which trip is longer?",
        "choices": [
          "The gentle one",
          "The steep one",
          "They are the same"
        ],
        "why": "A gentle ramp turns the same drop into a longer journey."
      }
    ],
    "g45": [
      {
        "q": "Two ramps have the same drop. Why is the gentle one slower?",
        "choices": [
          "Less of gravity’s pull speeds the marble",
          "Gravity is weaker on gentle ramps",
          "The marble rolls uphill"
        ],
        "why": "A steep ramp puts more of gravity’s pull into speed, and a gentle one puts in less."
      },
      {
        "q": "Your marble flies off the track at a turn. Which change could help?",
        "choices": [
          "Make the ramp before it gentler",
          "Make that ramp steeper",
          "Make the drop taller"
        ],
        "why": "A gentler ramp gives a slower roll."
      },
      {
        "q": "Which direction does gravity always pull?",
        "choices": [
          "Straight down",
          "Along the ramp",
          "Sideways"
        ],
        "why": "Gravity pulls straight down all the time."
      },
      {
        "q": "Which run gives a marble the most speed the fastest?",
        "choices": [
          "The steepest ramp",
          "The longest gentle ramp",
          "A flat track"
        ],
        "why": "A steep ramp lets the marble pick up speed faster."
      }
    ]
  },
  "activity:act-mirror-pattern": {
    "title": "Paint a Pattern That Repeats Like a Beat",
    "subject": "math",
    "k1": [
      {
        "q": "What makes a pattern?",
        "choices": [
          "Repeating",
          "Never repeating"
        ],
        "why": "Repeating something is what makes a pattern."
      },
      {
        "q": "What repeats the same shape around its middle?",
        "choices": [
          "A snowflake",
          "A puddle"
        ],
        "why": "Snowflakes repeat the same shape around their middle."
      },
      {
        "q": "Why is a song easy to remember?",
        "choices": [
          "Parts of it repeat",
          "It is quiet"
        ],
        "why": "Repeating something makes a song easy to remember."
      },
      {
        "q": "When you flip a symmetric shape, the parts...",
        "choices": [
          "Match",
          "Look different"
        ],
        "why": "Symmetry means one part matches another when it is flipped."
      }
    ],
    "g23": [
      {
        "q": "What does symmetry mean?",
        "choices": [
          "One part matches another",
          "All parts are different",
          "Shapes are colorful"
        ],
        "why": "Symmetry means one part matches another when turned or flipped."
      },
      {
        "q": "What does music repeat?",
        "choices": [
          "Beats and choruses",
          "Only the last note",
          "Nothing at all"
        ],
        "why": "Music repeats beats and choruses."
      },
      {
        "q": "How can one part match another in symmetry?",
        "choices": [
          "When it is turned or flipped",
          "When it is painted red",
          "When it is made bigger"
        ],
        "why": "Symmetry means one part matches another when it is turned or flipped."
      },
      {
        "q": "Why are patterns easy to see?",
        "choices": [
          "Something repeats",
          "They are always big",
          "They use one color"
        ],
        "why": "Repeating something is what makes a pattern easy to see."
      }
    ],
    "g45": [
      {
        "q": "How is a pattern in a painting like a beat in music?",
        "choices": [
          "Both are something that repeats",
          "Both are loud",
          "Both use one color"
        ],
        "why": "A pattern is a repeat, like a beat."
      },
      {
        "q": "A flower repeats one petal shape around its center. What does it show?",
        "choices": [
          "Symmetry",
          "A chorus",
          "A shadow"
        ],
        "why": "Many flowers repeat the same shape around their middle, which is symmetry."
      },
      {
        "q": "Fold a butterfly drawing in half and both sides match. What is that?",
        "choices": [
          "Symmetry by flipping",
          "A rhythm",
          "A color mix"
        ],
        "why": "Symmetry means one part matches another when it is flipped."
      },
      {
        "q": "Why does a chorus help people remember a song?",
        "choices": [
          "It repeats",
          "It is the longest part",
          "It is sung only once"
        ],
        "why": "Repeating something makes a song easy to remember."
      }
    ]
  },
  "activity:act-nature-colour-wheel": {
    "title": "The Nature Color Wheel",
    "subject": "art",
    "k1": [
      {
        "q": "Which three colors are the starting colors?",
        "choices": [
          "Red, yellow, blue",
          "Pink, black, white"
        ],
        "why": "Red, yellow and blue are the starting points."
      },
      {
        "q": "Mixing two starting colors makes...",
        "choices": [
          "A new color",
          "No color"
        ],
        "why": "Mix any two starting colors and you get a new color."
      },
      {
        "q": "Can a few paints make lots of colors?",
        "choices": [
          "Yes",
          "No"
        ],
        "why": "So few paints can produce so many colors."
      },
      {
        "q": "Which is a mixed color?",
        "choices": [
          "Green",
          "Red"
        ],
        "why": "Orange, green and purple are mixed colors. Red is a starting color."
      }
    ],
    "g23": [
      {
        "q": "Which colors do you get by mixing two starting colors?",
        "choices": [
          "Orange, green, purple",
          "Red, yellow, blue",
          "Black, white, gray"
        ],
        "why": "Mix any two of red, yellow and blue and you get orange, green or purple."
      },
      {
        "q": "On a color wheel, where does a mixed color go?",
        "choices": [
          "Between the two that make it",
          "At the very top",
          "Far from its colors"
        ],
        "why": "A color wheel puts each mixed color between the two colors that make it."
      },
      {
        "q": "Why can so few paints make so many colors?",
        "choices": [
          "They mix into new colors",
          "Paint changes in the sun",
          "Each paint has many colors"
        ],
        "why": "Red, yellow and blue mix into many other colors."
      },
      {
        "q": "Which one is a starting color?",
        "choices": [
          "Blue",
          "Purple",
          "Orange"
        ],
        "why": "Red, yellow and blue are the starting points."
      }
    ],
    "g45": [
      {
        "q": "Purple sits between red and blue on the wheel. What does that tell you?",
        "choices": [
          "Red and blue make purple",
          "Purple makes red and blue",
          "Purple is a starting color"
        ],
        "why": "Each mixed color sits between the two colors that make it."
      },
      {
        "q": "Why is a color wheel arranged the way it is?",
        "choices": [
          "Each mix sits between its two colors",
          "Colors go light to dark",
          "It follows the alphabet"
        ],
        "why": "A color wheel puts each mixed color between the two colors that make it."
      },
      {
        "q": "You have only red, yellow and blue paint. Can you paint a green leaf?",
        "choices": [
          "Yes, by mixing two of them",
          "No, green must be bought",
          "Only with white paint"
        ],
        "why": "Mix two of the starting colors and you can get green."
      },
      {
        "q": "Why are red, yellow and blue called starting points?",
        "choices": [
          "Other colors are mixed from them",
          "They are the brightest",
          "They come first in the alphabet"
        ],
        "why": "Red, yellow and blue mix into many other colors."
      }
    ]
  },
  "activity:act-neighborhood-map": {
    "title": "Draw a Map of Your Neighborhood",
    "subject": "reading",
    "k1": [
      {
        "q": "What can a map help you do?",
        "choices": [
          "Find the way",
          "Make music"
        ],
        "why": "A map can guide you somewhere."
      },
      {
        "q": "Maps show places using simple...",
        "choices": [
          "Shapes and lines",
          "Songs and sounds"
        ],
        "why": "A map uses simple shapes and lines."
      },
      {
        "q": "A map makes the street look...",
        "choices": [
          "Smaller",
          "Bigger"
        ],
        "why": "A map shrinks a real street down."
      },
      {
        "q": "Can a map help you go somewhere new?",
        "choices": [
          "Yes",
          "No"
        ],
        "why": "A map can guide you somewhere you have never been."
      }
    ],
    "g23": [
      {
        "q": "What is a map symbol?",
        "choices": [
          "A shape that stands for a place",
          "A real building",
          "A kind of street"
        ],
        "why": "A map uses symbols to stand in for real places."
      },
      {
        "q": "Why does a map shrink a street down?",
        "choices": [
          "A real street is too big to carry",
          "Streets are tiny",
          "To hide the street"
        ],
        "why": "A real street is too big to carry around, so a map shrinks it."
      },
      {
        "q": "What must you know to use a map well?",
        "choices": [
          "What each symbol means",
          "How to fly",
          "Everyone’s name"
        ],
        "why": "Once you know what each symbol means, the map can guide you."
      },
      {
        "q": "You draw a small square to stand for your school. What is the square?",
        "choices": [
          "A symbol",
          "A sentence",
          "A photo"
        ],
        "why": "A shape that stands in for a real place is a symbol."
      }
    ],
    "g45": [
      {
        "q": "How can a map guide you somewhere you’ve never been?",
        "choices": [
          "Its symbols stand for real places",
          "It shows live video",
          "It remembers your trips"
        ],
        "why": "Once you know what each symbol means, the map can guide you anywhere on it."
      },
      {
        "q": "What two things does a map do to a real street?",
        "choices": [
          "Shrinks it and uses symbols",
          "Grows it and adds sound",
          "Colors it and hides it"
        ],
        "why": "A map shrinks a street down and uses simple shapes and lines."
      },
      {
        "q": "A map doesn’t say what its symbols mean. What problem could happen?",
        "choices": [
          "You may not know what places they show",
          "The map gets bigger",
          "The streets move"
        ],
        "why": "A map guides you once you know what each symbol means."
      },
      {
        "q": "Which item on a map is a symbol?",
        "choices": [
          "A blue line standing for a creek",
          "The real creek water",
          "Your own shoes"
        ],
        "why": "A symbol is a simple shape or line that stands in for a real place."
      }
    ]
  },
  "activity:act-orrery": {
    "title": "The Desktop Solar System",
    "subject": "science",
    "k1": [
      {
        "q": "Which planets take longer to go around the sun?",
        "choices": [
          "Ones far away",
          "Ones close by"
        ],
        "why": "Planets farther from the sun take longer to go around it."
      },
      {
        "q": "Do the outer planets move fast or slow?",
        "choices": [
          "Slow",
          "Fast"
        ],
        "why": "The outer planets move more slowly along their loop."
      },
      {
        "q": "Earth goes around the sun once in a...",
        "choices": [
          "Year",
          "Minute"
        ],
        "why": "One trip around the sun takes Earth a year."
      },
      {
        "q": "An outer planet’s loop around the sun is...",
        "choices": [
          "Bigger",
          "Smaller"
        ],
        "why": "The outer planets have a much bigger loop to travel."
      }
    ],
    "g23": [
      {
        "q": "What are two reasons outer planets take longer?",
        "choices": [
          "Bigger loop and slower speed",
          "Smaller loop and faster speed",
          "They stop to rest"
        ],
        "why": "Outer planets have a bigger loop and move more slowly along it."
      },
      {
        "q": "Which planet takes about 165 of our years to go around?",
        "choices": [
          "Neptune",
          "Earth",
          "The moon"
        ],
        "why": "One trip around the sun takes Neptune about 165 of our years."
      },
      {
        "q": "How does an outer planet move along its loop?",
        "choices": [
          "More slowly",
          "More quickly",
          "Backward"
        ],
        "why": "The outer planets move more slowly along their loop."
      },
      {
        "q": "On a desktop solar system, which ball should go around slowest?",
        "choices": [
          "The one farthest out",
          "The one nearest the sun",
          "The sun itself"
        ],
        "why": "Planets farther from the sun take longer to go around it."
      }
    ],
    "g45": [
      {
        "q": "Is Neptune’s long trip only because of its bigger loop?",
        "choices": [
          "No, it also moves more slowly",
          "Yes, only the loop",
          "No, it stops often"
        ],
        "why": "Outer planets have a bigger loop and also move more slowly along it."
      },
      {
        "q": "Planet X is between Earth and Neptune. About how long is its year?",
        "choices": [
          "Between 1 and 165 Earth years",
          "Less than 1 Earth year",
          "More than 165 Earth years"
        ],
        "why": "Farther planets take longer, so it falls between Earth’s 1 year and Neptune’s 165."
      },
      {
        "q": "How many trips does Earth make while Neptune makes one?",
        "choices": [
          "About 165",
          "About 1",
          "About 16"
        ],
        "why": "Earth takes a year per trip, and Neptune takes about 165 of our years."
      },
      {
        "q": "Why is a far planet’s year so much longer than ours?",
        "choices": [
          "Longer path, traveled more slowly",
          "It spins faster",
          "The sun pulls it backward"
        ],
        "why": "The outer planets have a bigger loop and move more slowly along it."
      }
    ]
  },
  "activity:act-paper-airplane": {
    "title": "How to Make a Paper Glider",
    "subject": "science",
    "k1": [
      {
        "q": "What holds a paper plane up?",
        "choices": [
          "Air",
          "String"
        ],
        "why": "Air holds the plane up."
      },
      {
        "q": "Can you see air?",
        "choices": [
          "No",
          "Yes"
        ],
        "why": "You cannot see air."
      },
      {
        "q": "Air pushes on the plane’s...",
        "choices": [
          "Wings",
          "Shadow"
        ],
        "why": "Air pushes back against the wings."
      },
      {
        "q": "When your plane dips, what is it showing you?",
        "choices": [
          "What the air is doing",
          "That it is hungry"
        ],
        "why": "When the plane dips or curves, it shows what the air is doing."
      }
    ],
    "g23": [
      {
        "q": "How does air hold a plane up?",
        "choices": [
          "It pushes back on the wings",
          "It pulls the nose down",
          "It sticks to the paper"
        ],
        "why": "Air pushes back against the wings, and that push holds the plane up."
      },
      {
        "q": "Your glider curves to one side. What does that show?",
        "choices": [
          "What the air is doing",
          "The paper is too heavy",
          "The plane is broken"
        ],
        "why": "When the plane dips or curves, it is showing you what the air is doing."
      },
      {
        "q": "How can a paper plane help you “see” air?",
        "choices": [
          "Its moves show the air pushing",
          "It changes the air’s color",
          "It blows air out"
        ],
        "why": "You cannot see air, but a paper airplane can show it."
      },
      {
        "q": "Which part of the plane does the air push against?",
        "choices": [
          "The wings",
          "The pointy nose only",
          "Nothing at all"
        ],
        "why": "Air pushes back against the wings."
      }
    ],
    "g45": [
      {
        "q": "A glider stays up even though air is invisible. What explains this?",
        "choices": [
          "Air pushes back on its wings",
          "Paper weighs nothing",
          "Gravity turns off"
        ],
        "why": "Air pushes back against the wings, and that push holds the plane up."
      },
      {
        "q": "A plane suddenly dips. What is a good guess?",
        "choices": [
          "The air’s push on it changed",
          "The paper got heavier",
          "The plane ran out of fuel"
        ],
        "why": "When the plane dips, it is showing you what the air is doing."
      },
      {
        "q": "What job do the wings do?",
        "choices": [
          "Give the air something to push on",
          "Make the plane heavier",
          "Steer it with motors"
        ],
        "why": "Air pushes back against the wings, and that holds the plane up."
      },
      {
        "q": "How is a paper plane like a tool for studying air?",
        "choices": [
          "Its flight shows what air is doing",
          "It measures air temperature",
          "It stores air inside"
        ],
        "why": "A paper airplane shows you what the invisible air is doing."
      }
    ]
  },
  "activity:act-photo-comic": {
    "title": "Make a Photo Comic with Your Toys",
    "subject": "reading",
    "k1": [
      {
        "q": "A comic tells a story in...",
        "choices": [
          "Panels",
          "Songs"
        ],
        "why": "A comic tells a story in panels."
      },
      {
        "q": "How many moments does one panel show?",
        "choices": [
          "One",
          "Ten"
        ],
        "why": "Each panel shows one moment."
      },
      {
        "q": "Who fills in what happens between panels?",
        "choices": [
          "The reader",
          "The camera"
        ],
        "why": "Your reader fills in what happens between the panels."
      },
      {
        "q": "Do you need to show every moment?",
        "choices": [
          "No, just the big ones",
          "Yes, every one"
        ],
        "why": "You only need the most important moments."
      }
    ],
    "g23": [
      {
        "q": "What is a comic panel?",
        "choices": [
          "A box showing one moment",
          "The comic’s title",
          "A page of words only"
        ],
        "why": "Each panel shows one moment."
      },
      {
        "q": "What does a reader use to fill the gaps between panels?",
        "choices": [
          "Imagination",
          "A ruler",
          "A dictionary"
        ],
        "why": "Readers fill in the gaps with their imagination."
      },
      {
        "q": "Which moments should go in your photo comic?",
        "choices": [
          "The most important ones",
          "Every tiny step",
          "Only the ending"
        ],
        "why": "You only need the most important moments."
      },
      {
        "q": "Panel 1: toy at the top of a slide. Panel 2: toy at the bottom. What happened?",
        "choices": [
          "The toy slid down",
          "The toy flew away",
          "The toy fell asleep"
        ],
        "why": "The reader fills in what happens between panels."
      }
    ],
    "g45": [
      {
        "q": "Why don’t comics need to show every moment?",
        "choices": [
          "Readers fill gaps with imagination",
          "Comics have no room for pictures",
          "In-between moments don’t happen"
        ],
        "why": "Your reader fills in what happens between the panels with their imagination."
      },
      {
        "q": "You have 3 panels to show a race. Which set works best?",
        "choices": [
          "Start, big pass, finish",
          "Tying shoes three times",
          "Three shots of the finish"
        ],
        "why": "Pick the most important moments, one per panel."
      },
      {
        "q": "What should each panel focus on?",
        "choices": [
          "One important moment",
          "Many moments at once",
          "Only the setting"
        ],
        "why": "Each panel shows one moment."
      },
      {
        "q": "A friend’s comic has 40 panels of tiny steps. What advice fits?",
        "choices": [
          "Keep only the most important moments",
          "Add even more panels",
          "Remove all the pictures"
        ],
        "why": "You only need the most important moments."
      }
    ]
  },
  "activity:act-pixel-sprite": {
    "title": "Design a Pixel Game Character",
    "subject": "technology",
    "k1": [
      {
        "q": "Pictures on a screen are made of tiny...",
        "choices": [
          "Squares",
          "Circles"
        ],
        "why": "Screens are made of tiny squares."
      },
      {
        "q": "How many colors does one pixel show?",
        "choices": [
          "One",
          "Lots"
        ],
        "why": "Each pixel is a tiny square that shows one color."
      },
      {
        "q": "What are the tiny squares on a screen called?",
        "choices": [
          "Pixels",
          "Pebbles"
        ],
        "why": "The tiny squares are called pixels."
      },
      {
        "q": "Did early video games have lots of pixels?",
        "choices": [
          "No, very few",
          "Yes, tons"
        ],
        "why": "Early video games had very few pixels."
      }
    ],
    "g23": [
      {
        "q": "What is a pixel?",
        "choices": [
          "A tiny square of one color",
          "A tiny moving robot",
          "A kind of game"
        ],
        "why": "Pixels are tiny squares that each show one color."
      },
      {
        "q": "Why did early game artists choose every square carefully?",
        "choices": [
          "They had very few pixels",
          "Squares cost money",
          "Screens were round"
        ],
        "why": "Early games had very few pixels, so every square counted."
      },
      {
        "q": "You design a sprite on an 8 by 8 grid. What is each box?",
        "choices": [
          "A pixel",
          "A panel",
          "A layer"
        ],
        "why": "Every picture on a screen is built from pixels, tiny squares."
      },
      {
        "q": "What were early game artists trying to make?",
        "choices": [
          "A character you could recognize",
          "The most colors possible",
          "The biggest picture"
        ],
        "why": "Artists chose every square to make a character you could recognize."
      }
    ],
    "g45": [
      {
        "q": "With very few pixels, why does each square matter more?",
        "choices": [
          "Each is a bigger part of the picture",
          "Each pixel shows many colors",
          "Pixels move on their own"
        ],
        "why": "With few pixels, artists had to choose every square carefully."
      },
      {
        "q": "You change one pixel from blue to red. What changed?",
        "choices": [
          "One tiny square’s color",
          "The whole picture",
          "The screen size"
        ],
        "why": "Each pixel is a tiny square that shows one color."
      },
      {
        "q": "What is the same about every picture on a screen?",
        "choices": [
          "It is built from pixels",
          "It is drawn with pencils",
          "It is one big square"
        ],
        "why": "Every picture on a screen is built from pixels."
      },
      {
        "q": "Why might an early game hero look blocky?",
        "choices": [
          "It was made of very few pixels",
          "Artists only liked blocks",
          "Screens had no color"
        ],
        "why": "Early video games had very few pixels, so each square showed."
      }
    ]
  },
  "activity:act-pop-up-jungle": {
    "title": "The Pop-Up Jungle Book",
    "subject": "science",
    "k1": [
      {
        "q": "Camouflage helps animals...",
        "choices": [
          "Hide",
          "Sing"
        ],
        "why": "Camouflage helps animals hide in plain sight."
      },
      {
        "q": "A hiding animal’s colors match its...",
        "choices": [
          "Home",
          "Dinner"
        ],
        "why": "Some animals have colors that match where they live."
      },
      {
        "q": "Is a camouflaged animal easy to spot?",
        "choices": [
          "No, it is hard",
          "Yes, very easy"
        ],
        "why": "Camouflage makes animals hard to spot."
      },
      {
        "q": "Can camouflage help an animal stay safe?",
        "choices": [
          "Yes",
          "No"
        ],
        "why": "Being hard to spot helps animals stay safe."
      }
    ],
    "g23": [
      {
        "q": "What two things can match where an animal lives?",
        "choices": [
          "Colors and patterns",
          "Sounds and smells",
          "Size and speed"
        ],
        "why": "Some animals have colors and patterns that match where they live."
      },
      {
        "q": "What are two ways camouflage helps an animal?",
        "choices": [
          "Stay safe or sneak up on food",
          "Fly higher or swim faster",
          "Sing louder or sleep longer"
        ],
        "why": "Being hard to spot helps animals stay safe or sneak up on food."
      },
      {
        "q": "Your paper frog is green on green leaves. What trick is that?",
        "choices": [
          "Camouflage",
          "A shadow",
          "A reflection"
        ],
        "why": "Matching where it lives is camouflage."
      },
      {
        "q": "What does “hide in plain sight” mean?",
        "choices": [
          "Be right there but hard to spot",
          "Hide underground",
          "Hide behind a door"
        ],
        "why": "Camouflaged animals are right there but hard to spot."
      }
    ],
    "g45": [
      {
        "q": "How can camouflage help a hunting animal?",
        "choices": [
          "It can sneak up on food",
          "It can run faster",
          "It scares food away"
        ],
        "why": "Camouflage helps some animals sneak up on food."
      },
      {
        "q": "A white rabbit sits on green grass. What is the problem?",
        "choices": [
          "It doesn’t match, so it’s easy to spot",
          "It is too fast",
          "It blends in perfectly"
        ],
        "why": "Camouflage works when colors match where an animal lives."
      },
      {
        "q": "Why do camouflaged animals have different patterns?",
        "choices": [
          "Each matches where it lives",
          "They pick patterns they like",
          "Patterns are random"
        ],
        "why": "Some animals have colors and patterns that match where they live."
      },
      {
        "q": "Your paper animal “did the same trick.” What trick?",
        "choices": [
          "Blending in with its background",
          "Popping up off the page",
          "Changing its size"
        ],
        "why": "Your paper animal hid in plain sight, like camouflaged animals do."
      }
    ]
  },
  "activity:act-rainy-drumbeat": {
    "title": "The Rainy-Day Drumbeat",
    "subject": "music",
    "k1": [
      {
        "q": "Rhythm is a sound pattern that...",
        "choices": [
          "Repeats",
          "Never comes back"
        ],
        "why": "Rhythm is a pattern of sound that repeats."
      },
      {
        "q": "When a good rhythm plays, people want to...",
        "choices": [
          "Move",
          "Fall asleep"
        ],
        "why": "A good rhythm makes people want to move."
      },
      {
        "q": "Can your ears learn a pattern?",
        "choices": [
          "Yes",
          "No"
        ],
        "why": "Your ears learn the pattern and start predicting it."
      },
      {
        "q": "Tap, tap, boom. Tap, tap, boom. Is that a rhythm?",
        "choices": [
          "Yes",
          "No"
        ],
        "why": "It comes back around, so it is a rhythm."
      }
    ],
    "g23": [
      {
        "q": "When does a beat become a rhythm?",
        "choices": [
          "When it comes back around",
          "When it is very loud",
          "When it is played once"
        ],
        "why": "A beat only becomes a rhythm when it comes back around."
      },
      {
        "q": "Once your ears learn a pattern, what do they do?",
        "choices": [
          "Predict what comes next",
          "Stop hearing it",
          "Forget it"
        ],
        "why": "Once your ears learn the pattern, they start predicting it."
      },
      {
        "q": "Which of these is a rhythm?",
        "choices": [
          "Drip, drop, drip, drop",
          "One single drip",
          "Noises with no pattern"
        ],
        "why": "Rhythm is a pattern of sound that repeats."
      },
      {
        "q": "Why does a good rhythm make you want to move?",
        "choices": [
          "Your ears predict the pattern",
          "It is always fast",
          "It is very quiet"
        ],
        "why": "Your ears predict the pattern, so people want to move before they decide to."
      }
    ],
    "g45": [
      {
        "q": "Why is one drum hit not yet a rhythm?",
        "choices": [
          "It has not repeated",
          "It is too loud",
          "It needs a guitar"
        ],
        "why": "A beat only becomes a rhythm when it comes back around."
      },
      {
        "q": "People start tapping before they decide to. Why?",
        "choices": [
          "Their ears already predict the beat",
          "Someone tells them to",
          "Tapping is a rule"
        ],
        "why": "Once ears learn the pattern, they predict it, so people move before they decide to."
      },
      {
        "q": "You want listeners to join in. What should your beat do?",
        "choices": [
          "Repeat a clear pattern",
          "Change every time",
          "Play only once"
        ],
        "why": "A repeating pattern lets ears learn and predict it."
      },
      {
        "q": "What does it mean that ears “predict” a rhythm?",
        "choices": [
          "They expect the next beat",
          "They make the beat louder",
          "They hear it backward"
        ],
        "why": "Once your ears learn the pattern, they start predicting what comes next."
      }
    ]
  },
  "activity:act-recycled-robot": {
    "title": "The Recycled Robot Friend",
    "subject": "science",
    "k1": [
      {
        "q": "Reusing a tin keeps it out of the...",
        "choices": [
          "Trash",
          "Garden"
        ],
        "why": "Reusing and recycling keep materials out of the trash."
      },
      {
        "q": "Is building a robot from old tubs reusing?",
        "choices": [
          "Yes",
          "No"
        ],
        "why": "Building with old tins and tubs counts as reusing."
      },
      {
        "q": "Which takes less energy?",
        "choices": [
          "Reusing",
          "Melting it down"
        ],
        "why": "Reusing something as it is takes less energy than melting it down."
      },
      {
        "q": "Do recycling and reusing both help?",
        "choices": [
          "Yes, both",
          "No, neither"
        ],
        "why": "Reusing and recycling both keep materials out of the trash."
      }
    ],
    "g23": [
      {
        "q": "What do reusing and recycling both do?",
        "choices": [
          "Keep things out of the trash",
          "Make new trash",
          "Use more energy"
        ],
        "why": "Reusing and recycling both keep materials out of the trash."
      },
      {
        "q": "Why does reusing take less energy than recycling?",
        "choices": [
          "Nothing has to be melted down",
          "It uses bigger machines",
          "It needs more water"
        ],
        "why": "Reusing something as it is takes less energy than melting it down."
      },
      {
        "q": "Building a robot with old tins counts as what?",
        "choices": [
          "Reusing",
          "Throwing away",
          "Melting"
        ],
        "why": "Building with old tins and tubs counts as reusing."
      },
      {
        "q": "Before your robot, what was going to happen to its tins and tubs?",
        "choices": [
          "They would become something else",
          "They would go to a toy store",
          "They would grow bigger"
        ],
        "why": "Every tin and tub was on its way to becoming something else."
      }
    ],
    "g45": [
      {
        "q": "Which uses the least energy for an old jar?",
        "choices": [
          "Using it again as it is",
          "Melting it into a new jar",
          "Making a new jar from scratch"
        ],
        "why": "Reusing something as it is takes even less energy than melting it down."
      },
      {
        "q": "How is reusing different from recycling?",
        "choices": [
          "Reusing keeps it as it is",
          "Reusing melts it down",
          "They are exactly the same"
        ],
        "why": "Reusing uses something as it is, while recycling melts it down."
      },
      {
        "q": "Why does building a robot “count too”?",
        "choices": [
          "Reusing keeps materials out of the trash",
          "Robots are made in factories",
          "It uses brand new materials"
        ],
        "why": "Reusing, like recycling, keeps materials out of the trash."
      },
      {
        "q": "A yogurt tub becomes a plant pot. Which is that?",
        "choices": [
          "Reusing",
          "Recycling",
          "Trashing"
        ],
        "why": "Using something again as it is counts as reusing."
      }
    ]
  },
  "activity:act-rubber-band-guitar": {
    "title": "The Rubber-Band Guitar",
    "subject": "music",
    "k1": [
      {
        "q": "A tight rubber band makes a sound that is...",
        "choices": [
          "Higher",
          "Lower"
        ],
        "why": "Tighter strings make higher sounds."
      },
      {
        "q": "When you pluck a band, it...",
        "choices": [
          "Wiggles back and forth",
          "Stays still"
        ],
        "why": "A plucked band vibrates back and forth."
      },
      {
        "q": "Which band sounds higher?",
        "choices": [
          "A thin one",
          "A thick one"
        ],
        "why": "Thinner strings make higher sounds."
      },
      {
        "q": "Faster wiggles make a note that is...",
        "choices": [
          "Higher",
          "Lower"
        ],
        "why": "Faster vibrations reach your ear as a higher note."
      }
    ],
    "g23": [
      {
        "q": "Which three things make a band sound higher?",
        "choices": [
          "Thin, tight and short",
          "Thick, loose and long",
          "Red, blue and green"
        ],
        "why": "Thin, tight, short bands vibrate faster and sound higher."
      },
      {
        "q": "What does a band do when you pluck it?",
        "choices": [
          "Vibrates back and forth",
          "Melts",
          "Grows longer"
        ],
        "why": "A plucked band vibrates back and forth."
      },
      {
        "q": "A loose, thick band makes what kind of note?",
        "choices": [
          "Lower",
          "Higher",
          "No note"
        ],
        "why": "Thin, tight bands sound higher, so loose, thick ones sound lower."
      },
      {
        "q": "Do real stringed instruments use this same idea?",
        "choices": [
          "Yes, every one",
          "No, none do",
          "Only one kind does"
        ],
        "why": "Every stringed instrument is built around this one idea."
      }
    ],
    "g45": [
      {
        "q": "Why does a tighter band make a higher note?",
        "choices": [
          "It vibrates faster",
          "It vibrates slower",
          "It gets louder"
        ],
        "why": "Tight bands vibrate faster, and faster vibrations sound higher."
      },
      {
        "q": "You want the lowest note on your guitar. Which band?",
        "choices": [
          "Thick, loose and long",
          "Thin, tight and short",
          "Any band, all the same"
        ],
        "why": "Thin, tight, short bands sound highest, so the opposite sounds lowest."
      },
      {
        "q": "What reaches your ear as a higher note?",
        "choices": [
          "Faster vibrations",
          "Slower vibrations",
          "Bigger rubber bands"
        ],
        "why": "Faster vibrations reach your ear as a higher note."
      },
      {
        "q": "A guitarist tightens a string. What happens to its note?",
        "choices": [
          "It goes higher",
          "It goes lower",
          "It stays the same"
        ],
        "why": "Tighter strings vibrate faster and make higher sounds."
      }
    ]
  },
  "activity:act-sailcar": {
    "title": "The Wind-Powered Sail Car",
    "subject": "science",
    "k1": [
      {
        "q": "What pushes the sail?",
        "choices": [
          "Wind",
          "Water"
        ],
        "why": "Wind pushes the sail."
      },
      {
        "q": "What does the sail push?",
        "choices": [
          "The car",
          "The wind"
        ],
        "why": "The sail pushes the car."
      },
      {
        "q": "A big sail gives the wind...",
        "choices": [
          "More to push on",
          "Less to push on"
        ],
        "why": "A sail gives the wind a big surface to push against."
      },
      {
        "q": "Is wind moving air?",
        "choices": [
          "Yes",
          "No"
        ],
        "why": "Wind is moving air."
      }
    ],
    "g23": [
      {
        "q": "What is moving air made of?",
        "choices": [
          "Tiny particles",
          "Water drops",
          "Nothing at all"
        ],
        "why": "Moving air is made of countless tiny particles."
      },
      {
        "q": "How does the push get from the sail to the car?",
        "choices": [
          "Through the mast",
          "Through the wind",
          "Through the road"
        ],
        "why": "The push travels through the mast into the car."
      },
      {
        "q": "Why does the car need a sail?",
        "choices": [
          "To give the wind something to push",
          "To make it heavier",
          "To block the road"
        ],
        "why": "A sail gives the air a big surface to push against."
      },
      {
        "q": "What happens when tiny air particles hit the sail?",
        "choices": [
          "They push it",
          "They pull it backward",
          "They stick to it"
        ],
        "why": "Air particles bump into the sail and push it."
      }
    ],
    "g45": [
      {
        "q": "Which order does the push travel in?",
        "choices": [
          "Wind, sail, mast, car",
          "Car, mast, sail, wind",
          "Sail, wind, car, mast"
        ],
        "why": "Wind pushes the sail, and the push travels through the mast into the car."
      },
      {
        "q": "Why does a bigger sail help in the same wind?",
        "choices": [
          "More particles push on it",
          "The wind blows harder",
          "The car gets lighter"
        ],
        "why": "A sail gives the particles a big surface to push against."
      },
      {
        "q": "If the mast broke off, what would happen?",
        "choices": [
          "The push would not reach the car",
          "The car would go faster",
          "The wind would stop"
        ],
        "why": "The push travels through the mast into the car."
      },
      {
        "q": "How can air push anything if you can’t see it?",
        "choices": [
          "Its tiny particles bump into things",
          "Air is a solid",
          "The car pulls the air"
        ],
        "why": "Moving air is countless tiny particles bumping into whatever is in the way."
      }
    ]
  },
  "activity:act-shadow-puppets": {
    "title": "The Shadow Puppet Theater",
    "subject": "science",
    "k1": [
      {
        "q": "What makes a shadow?",
        "choices": [
          "Blocking light",
          "Playing music"
        ],
        "why": "Blocking light makes a shadow."
      },
      {
        "q": "Light travels in lines that are...",
        "choices": [
          "Straight",
          "Curly"
        ],
        "why": "Light travels in straight lines."
      },
      {
        "q": "Move the puppet closer to the lamp. The shadow gets...",
        "choices": [
          "Bigger",
          "Smaller"
        ],
        "why": "Closer to the lamp, the puppet blocks more light, so the shadow grows."
      },
      {
        "q": "Does light bend around your puppet?",
        "choices": [
          "No",
          "Yes"
        ],
        "why": "Light does not bend around your puppet."
      }
    ],
    "g23": [
      {
        "q": "Why does a shadow have the puppet’s shape?",
        "choices": [
          "Light can’t pass through it",
          "The wall copies it",
          "The lamp draws it"
        ],
        "why": "The shape light cannot pass through appears on the wall."
      },
      {
        "q": "You want a giant dragon shadow. What do you do?",
        "choices": [
          "Move the puppet closer to the lamp",
          "Move it away from the lamp",
          "Turn off the lamp"
        ],
        "why": "Move the puppet closer to the lamp and the shadow grows."
      },
      {
        "q": "How does light travel?",
        "choices": [
          "In straight lines",
          "In circles",
          "Around corners"
        ],
        "why": "Light travels in straight lines."
      },
      {
        "q": "Why does a puppet near the lamp make a bigger shadow?",
        "choices": [
          "It blocks more of the light",
          "The puppet grows",
          "The light gets dimmer"
        ],
        "why": "Closer to the lamp, the puppet blocks more of the light."
      }
    ],
    "g45": [
      {
        "q": "If light could bend around objects, what would happen to shadows?",
        "choices": [
          "They would fade or vanish",
          "They would get darker",
          "They would get sharper"
        ],
        "why": "Shadows form because light goes straight and cannot bend around things."
      },
      {
        "q": "The shadow is too big for the screen. What fix works?",
        "choices": [
          "Move the puppet away from the lamp",
          "Move it closer to the lamp",
          "Add a second puppet"
        ],
        "why": "Closer to the lamp makes a bigger shadow, so moving away shrinks it."
      },
      {
        "q": "Why does a shadow show an outline and not the puppet’s colors?",
        "choices": [
          "It shows where light was blocked",
          "Walls cannot hold color",
          "The lamp is too dim"
        ],
        "why": "A shadow is the shape the light cannot pass through."
      },
      {
        "q": "Which two facts explain shadows?",
        "choices": [
          "Light goes straight and can be blocked",
          "Light bends and can be bounced",
          "Light is cold and dark"
        ],
        "why": "Light travels in straight lines, so blocking it makes a shadow."
      }
    ]
  },
  "activity:act-story-cubes": {
    "title": "The Story Cube Storm",
    "subject": "reading",
    "k1": [
      {
        "q": "A story has a beginning, a middle and an...",
        "choices": [
          "End",
          "Echo"
        ],
        "why": "A story needs a beginning, a middle and an end."
      },
      {
        "q": "Where does the problem show up?",
        "choices": [
          "The middle",
          "The title"
        ],
        "why": "The middle is where the problem shows up."
      },
      {
        "q": "The beginning tells us who and...",
        "choices": [
          "Where",
          "How tall"
        ],
        "why": "The beginning tells us who and where."
      },
      {
        "q": "At the end of a story, something...",
        "choices": [
          "Changes",
          "Stays the same"
        ],
        "why": "The end is where something changes."
      }
    ],
    "g23": [
      {
        "q": "Which part of a story tells who and where?",
        "choices": [
          "The beginning",
          "The middle",
          "The end"
        ],
        "why": "The beginning tells us who and where."
      },
      {
        "q": "What happens at the end of a story?",
        "choices": [
          "Something changes",
          "The problem first shows up",
          "We meet the characters"
        ],
        "why": "The end is where something changes."
      },
      {
        "q": "You roll a cat, a boat and a storm. What can you make?",
        "choices": [
          "A story with three parts",
          "A shopping list",
          "A math problem"
        ],
        "why": "With a beginning, middle and end, you can build a story out of almost any three things."
      },
      {
        "q": "A dragon loses its fire. Which part of the story is this?",
        "choices": [
          "The middle",
          "The beginning",
          "The end"
        ],
        "why": "The middle is where the problem shows up."
      }
    ],
    "g45": [
      {
        "q": "Why can almost any three things become a story?",
        "choices": [
          "They fit a beginning, middle and end",
          "Stories need exactly three things",
          "Cubes choose the story for you"
        ],
        "why": "Once you know the three parts, you can build a story out of almost any three things."
      },
      {
        "q": "A story stops right after the problem appears. What is missing?",
        "choices": [
          "The end, where something changes",
          "The beginning",
          "The title"
        ],
        "why": "The end is where something changes."
      },
      {
        "q": "“Yuna lived by the sea.” Which part of a story is this?",
        "choices": [
          "The beginning",
          "The middle",
          "The end"
        ],
        "why": "The beginning tells us who and where."
      },
      {
        "q": "Problem: the boat springs a leak. Which ending fits?",
        "choices": [
          "They patch it and sail home",
          "Yuna lived by the sea",
          "The boat had a leak"
        ],
        "why": "The end is where something changes, like fixing the problem."
      }
    ]
  },
  "activity:act-storybook-mystery": {
    "title": "The Mystery in the Storybook",
    "subject": "reading",
    "k1": [
      {
        "q": "In a fair mystery, who gets to see the clues?",
        "choices": [
          "The reader",
          "Only the detective"
        ],
        "why": "Every clue the detective uses is shown to the reader first."
      },
      {
        "q": "A good mystery ending feels...",
        "choices": [
          "Surprising",
          "Boring"
        ],
        "why": "A fair ending feels surprising but possible."
      },
      {
        "q": "Could a sharp reader solve a fair mystery?",
        "choices": [
          "Yes",
          "No"
        ],
        "why": "A sharp reader could have solved it too."
      },
      {
        "q": "What does a detective use to solve a mystery?",
        "choices": [
          "Clues",
          "Candy"
        ],
        "why": "The detective uses clues."
      }
    ],
    "g23": [
      {
        "q": "What does it mean for a mystery to play fair?",
        "choices": [
          "Clues are shown to the reader first",
          "The detective just guesses",
          "The ending has no clues"
        ],
        "why": "In a fair mystery, every clue is shown to the reader first."
      },
      {
        "q": "Why show the reader every clue?",
        "choices": [
          "So they could solve it too",
          "To make the book longer",
          "So the ending is impossible"
        ],
        "why": "Showing every clue means a sharp reader could solve it too."
      },
      {
        "q": "A good mystery ending is surprising but also...",
        "choices": [
          "Possible",
          "Impossible",
          "Boring"
        ],
        "why": "The ending feels surprising but possible."
      },
      {
        "q": "The detective finds a muddy boot. When should the reader see it?",
        "choices": [
          "Before the answer is told",
          "After the book ends",
          "Never"
        ],
        "why": "Every clue is shown to the reader first."
      }
    ],
    "g45": [
      {
        "q": "A detective solves it with a clue never shown. What went wrong?",
        "choices": [
          "The mystery did not play fair",
          "The ending was too possible",
          "There were too many clues"
        ],
        "why": "A fair mystery shows every clue to the reader first."
      },
      {
        "q": "Why does a fair mystery’s ending feel possible?",
        "choices": [
          "The clues were shown along the way",
          "The reader wrote the ending",
          "It has no surprise"
        ],
        "why": "Every clue was shown first, so the ending feels possible."
      },
      {
        "q": "How can a writer make a mystery solvable for sharp readers?",
        "choices": [
          "Show every clue before the reveal",
          "Hide the key clue until the end",
          "Leave out the clues"
        ],
        "why": "Every clue the detective uses is shown to the reader first."
      },
      {
        "q": "Rereading a fair mystery, what would you notice?",
        "choices": [
          "The clues were there all along",
          "The clues changed",
          "There were no clues"
        ],
        "why": "In a fair mystery, every clue was shown to the reader first."
      }
    ]
  },
  "activity:act-treehouse-blueprint": {
    "title": "Draw the Treehouse You Would Build",
    "subject": "math",
    "k1": [
      {
        "q": "A scale drawing makes something big look...",
        "choices": [
          "Smaller",
          "Bigger"
        ],
        "why": "A scale drawing shrinks something big."
      },
      {
        "q": "Does a scale drawing change the shape?",
        "choices": [
          "No",
          "Yes"
        ],
        "why": "A scale drawing shrinks something without changing its shape."
      },
      {
        "q": "Can a whole house fit on one page?",
        "choices": [
          "Yes, in a scale drawing",
          "No, never"
        ],
        "why": "A builder can hold a whole house on one page."
      },
      {
        "q": "Who uses scale drawings to build?",
        "choices": [
          "Builders",
          "Fish"
        ],
        "why": "Builders use scale drawings to know where everything goes."
      }
    ],
    "g23": [
      {
        "q": "In a scale drawing, how do the measurements shrink?",
        "choices": [
          "All by the same amount",
          "Some more than others",
          "They don’t shrink"
        ],
        "why": "Every measurement shrinks by the same amount."
      },
      {
        "q": "Why is a scale drawing useful to a builder?",
        "choices": [
          "It shows exactly where things go",
          "It makes the house bigger",
          "It hides the door"
        ],
        "why": "A builder knows exactly where the door goes."
      },
      {
        "q": "What stays the same in a scale drawing?",
        "choices": [
          "The shape",
          "The size",
          "The weight"
        ],
        "why": "A scale drawing shrinks something without changing its shape."
      },
      {
        "q": "A real wall is 10 feet long. At 1 inch for each foot, how long is it drawn?",
        "choices": [
          "10 inches",
          "1 inch",
          "20 inches"
        ],
        "why": "Every foot becomes 1 inch, so 10 feet becomes 10 inches."
      }
    ],
    "g45": [
      {
        "q": "One side shrinks by half and another by a third. What happens?",
        "choices": [
          "The shape changes",
          "It stays a true scale drawing",
          "Nothing happens"
        ],
        "why": "A drawing stays true only when every measurement shrinks by the same amount."
      },
      {
        "q": "Your treehouse is 8 ft wide and 6 ft tall. At 1 inch per foot?",
        "choices": [
          "8 in wide, 6 in tall",
          "8 in wide, 3 in tall",
          "4 in wide, 6 in tall"
        ],
        "why": "Every measurement shrinks the same way, so each foot becomes an inch."
      },
      {
        "q": "How can a builder find the door’s spot from a drawing?",
        "choices": [
          "Every measurement shrank the same",
          "The door is drawn bigger",
          "Builders just guess"
        ],
        "why": "When every measurement shrinks by the same amount, the drawing stays true."
      },
      {
        "q": "A 12-foot ladder is drawn 6 inches long. What scale is that?",
        "choices": [
          "1 inch for every 2 feet",
          "1 inch for every foot",
          "2 inches for every foot"
        ],
        "why": "12 feet shown as 6 inches means each inch stands for 2 feet."
      }
    ]
  },
  "activity:act-write-with-yuna": {
    "title": "Write with Yuna",
    "subject": "reading",
    "k1": [
      {
        "q": "Where do you start a letter?",
        "choices": [
          "At the top",
          "At the bottom"
        ],
        "why": "Teachers show each letter starting at the top."
      },
      {
        "q": "Should you write a letter the same way every time?",
        "choices": [
          "Yes",
          "No"
        ],
        "why": "Doing it the same way every time helps your hand remember."
      },
      {
        "q": "Letters should sit on the...",
        "choices": [
          "Writing lines",
          "Edge of the table"
        ],
        "why": "Keep your letters on the writing lines."
      },
      {
        "q": "Doing it the same way helps your hand...",
        "choices": [
          "Remember",
          "Forget"
        ],
        "why": "Doing it the same way every time helps your hand remember."
      }
    ],
    "g23": [
      {
        "q": "Why write each letter the same way every time?",
        "choices": [
          "So your hand remembers it",
          "So it looks different",
          "So it takes longer"
        ],
        "why": "Doing it the same way every time helps your hand remember."
      },
      {
        "q": "Which three things do teachers show for each letter?",
        "choices": [
          "Top start, set order, on the lines",
          "Big, bold and colorful",
          "Fast, slanted and backward"
        ],
        "why": "Start at the top, follow a set order of lines, and keep them on the writing lines."
      },
      {
        "q": "What happens to your writing as your hand remembers?",
        "choices": [
          "It gets quicker and neater",
          "It gets slower",
          "It gets messier"
        ],
        "why": "When your hand remembers, your writing gets quicker and neater."
      },
      {
        "q": "Later on, letters join up into what?",
        "choices": [
          "Cursive",
          "Pictures",
          "Numbers"
        ],
        "why": "Later, the letters join up into cursive."
      }
    ],
    "g45": [
      {
        "q": "Why does starting a letter in the same place matter?",
        "choices": [
          "It builds a habit your hand remembers",
          "It makes the letters bigger",
          "It uses less paper"
        ],
        "why": "Doing it the same way every time helps your hand remember."
      },
      {
        "q": "Steady letter habits now get you ready for what later?",
        "choices": [
          "Joining letters into cursive",
          "Drawing maps",
          "Typing faster"
        ],
        "why": "Later, the letters join up into cursive."
      },
      {
        "q": "A friend starts letters in a different spot each time. What may happen?",
        "choices": [
          "Writing stays slow and messy",
          "Writing gets neater",
          "Cursive gets easier"
        ],
        "why": "Doing it the same way every time is what makes writing quicker and neater."
      },
      {
        "q": "Which habit leads to quicker, neater writing?",
        "choices": [
          "Making each letter the same way",
          "Changing it every time",
          "Writing off the lines"
        ],
        "why": "Doing it the same way every time makes writing quicker and neater."
      }
    ]
  }
};
