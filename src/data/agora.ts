export interface AgoraResponse {
  philosopherId: string;
  posts: string[];
}

export interface AgoraThread {
  id: string;
  question: string;
  askedBy: string;
  timestamp: string;
  philosophers: string[];
  responses: AgoraResponse[];
  synthesis: {
    tensions: string[];
    agreements: string[];
    practicalTakeaways: string[];
  };
}

export const agoraThreads: AgoraThread[] = [
  {
    id: "ambition-or-destruction",
    question:
      "I\u2019ve been working 70-hour weeks for a promotion I\u2019m not sure I even want. My partner says I\u2019ve changed. How do I know if ambition is driving me or destroying me?",
    askedBy: "Anonymous User",
    timestamp: "2 days ago",
    philosophers: ["seneca", "kierkegaard", "confucius", "camus"],
    responses: [
      {
        philosopherId: "seneca",
        posts: [
          "My friend, you remind me of the people I describe in On the Shortness of Life \u2014 busy, productive, and entirely missing the point. You have traded your time \u2014 the one truly irreplaceable thing \u2014 for a promotion you are not even sure you want. Consider: if you were told you had one year to live, would you spend it pursuing this title? If not, why are you spending your life on it now? Life is not short. You are making it short.",
          "Your partner is not wrong. Ambition that alienates those who love you is not ambition \u2014 it is flight. You are running from something, and the 70-hour weeks are your hiding place. I say this gently, as one who hid in wealth and imperial politics for decades: ask yourself what you are avoiding. The answer is usually simpler and more frightening than the work.",
        ],
      },
      {
        philosopherId: "kierkegaard",
        posts: [
          "The aesthetic person lives for the next pleasure, the next achievement, the next promotion. The ethical person lives by commitment \u2014 to a partner, a principle, a chosen life. You are suspended between the two, and this is precisely why you feel the dread.",
          "Your partner says you\u2019ve changed. Have you? Or have you simply revealed which stage you\u2019re living in? The promotion is not the question. The question is: are you choosing your life, or drifting through it while calling the drift \u2018ambition\u2019? Either/or. You cannot have both.",
        ],
      },
      {
        philosopherId: "confucius",
        posts: [
          "The Master would ask: what is your role? You are a worker, yes. But you are also a partner. A son or daughter, perhaps. A friend. The junzi does not sacrifice one role for another \u2014 he seeks to fulfill each with propriety. Seventy hours of work suggests one role has consumed all others.",
          "Consider your partner\u2019s words carefully. In the Confucian tradition, right relationships are the foundation of a virtuous life. A promotion gained at the cost of your closest relationship is not a promotion \u2014 it is a demotion of your character. Restore the balance. Begin with what is nearest.",
        ],
      },
      {
        philosopherId: "camus",
        posts: [
          "Let me ask you the real question: when you push the boulder up the hill \u2014 these 70-hour weeks, this promotion \u2014 are you happy? Not satisfied. Not \u2018productive.\u2019 Happy. Because Sisyphus is only a hero if he is conscious of his task and chooses it freely.",
          "If you are pushing the boulder because you believe it will bring you to a summit, I have bad news: there is no summit. But if you push because the work itself gives you something \u2014 because the struggle fills your heart \u2014 then push. If not, put the boulder down. There are other hills, and your partner is waiting at the bottom of this one.",
        ],
      },
    ],
    synthesis: {
      tensions: [
        "Individual fulfillment vs. relational obligation: Kierkegaard and Camus focus on authentic individual choice, while Confucius and Seneca emphasize the cost to relationships and proper social roles.",
        "Meaning through work vs. meaning through presence: Camus asks whether the work itself is fulfilling, while Seneca argues that busyness is usually a form of avoidance.",
      ],
      agreements: [
        "All four agree that unreflective ambition \u2014 working without knowing why \u2014 is a form of self-deception that will eventually exact a cost.",
      ],
      practicalTakeaways: [
        "Ask Seneca\u2019s test: if you had one year left, would you still pursue this promotion?",
        "Kierkegaard\u2019s challenge: are you choosing, or drifting? Name what you\u2019re actually doing.",
        "Confucius\u2019s priority: restore your closest relationships before optimizing your career.",
        "Camus\u2019s question: is the work itself enough, or are you chasing a summit that doesn\u2019t exist?",
      ],
    },
  },
  {
    id: "father-refuses-treatment",
    question:
      "My father is very ill and refuses treatment for religious reasons. Do I have the right to intervene?",
    askedBy: "Anonymous User",
    timestamp: "4 days ago",
    philosophers: ["augustine", "kant", "russell", "marcus-aurelius"],
    responses: [],
    synthesis: {
      tensions: [],
      agreements: [],
      practicalTakeaways: [],
    },
  },
  {
    id: "guilt-about-happiness",
    question:
      "I feel guilty about being happy when so much of the world is suffering. Is this guilt rational or just self-indulgent?",
    askedBy: "Anonymous User",
    timestamp: "6 days ago",
    philosophers: ["dostoevsky", "camus", "seneca", "plato"],
    responses: [],
    synthesis: {
      tensions: [],
      agreements: [],
      practicalTakeaways: [],
    },
  },
];
