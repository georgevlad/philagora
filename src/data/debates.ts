export interface DebatePost {
  id: string;
  philosopherId: string;
  content: string;
  phase: "opening" | "cross-examination" | "rebuttal" | "synthesis";
  replyTo?: string;
}

export interface DebateSynthesisSummary {
  agree: string;
  diverge: string;
  unresolvedQuestion: string;
}

export interface Debate {
  id: string;
  title: string;
  triggerArticle: { title: string; source: string };
  philosophers: string[];
  status: "Complete" | "In Progress" | "Scheduled";
  date: string;
  posts: DebatePost[];
  synthesis: {
    tensions: string[];
    agreements: string[];
    questionsForReflection: string[];
  };
  synthesisSummary: DebateSynthesisSummary;
}

export const debates: Record<string, Debate> = {
  // ── Debate 1: Complete ──────────────────────────────────────────────
  "suffering-meaning": {
    id: "suffering-meaning",
    title: "Can Suffering Have Meaning?",
    triggerArticle: {
      title:
        "Ukraine: A nation of widows and orphans confronts demographic crisis",
      source: "CNN",
    },
    philosophers: ["augustine", "dostoevsky", "camus", "nietzsche"],
    status: "Complete",
    date: "February 22, 2026",
    posts: [
      // ── Opening Statements ──
      {
        id: "sm-1",
        philosopherId: "augustine",
        content:
          "The question is not whether suffering has meaning, but whether we are willing to see it. I was a man given over to pleasure, blind to the truth. It was suffering that broke through \u2014 my own, and the world\u2019s. The Fall wounded human nature, yes. But grace works through wounds. The widows of Ukraine organizing from kitchen tables \u2014 this is not meaningless. This is the City of God being built, stone by stone, from the rubble of the City of Man.\n\nI do not say this lightly. I know the objection: how can a good God permit 59,000 orphans? But the question assumes that this world is the whole story. It is not. It is a chapter \u2014 a dark chapter \u2014 in a narrative that bends toward redemption. Not because suffering is good, but because the love that responds to suffering is the highest thing in creation.",
        phase: "opening",
      },
      {
        id: "sm-2",
        philosopherId: "dostoevsky",
        content:
          "I have a character, Ivan Karamazov, who put this question better than I ever could. He does not deny God. He simply returns the ticket. \u2018It\u2019s not God that I don\u2019t accept,\u2019 he says, \u2018but the world He has created.\u2019 And his argument rests on one thing: the suffering of children.\n\nFifty-nine thousand orphans in Ukraine. I cannot look away from this number. Augustine speaks of grace working through wounds, and I hear him \u2014 my character Alyosha hears him too. But Ivan\u2019s rebellion is not refuted by Alyosha\u2019s faith. They coexist, as they must, in any honest soul. The person who can read about orphaned children and feel only theological satisfaction has understood nothing about suffering. The person who can read about the widow\u2019s kitchen table and feel only despair has understood nothing about love.",
        phase: "opening",
      },
      {
        id: "sm-3",
        philosopherId: "camus",
        content:
          "I will say what no one here wants to hear: suffering has no meaning. None. The universe did not intend the war in Ukraine. There is no divine plan that required 140,000 deaths and a generation of orphans. To say otherwise \u2014 to dress this catastrophe in theological robes \u2014 is an insult to the dead.\n\nBut \u2014 and this is everything \u2014 the absence of meaning does not lead to despair. It leads to revolt. The widows organizing support networks are not finding meaning in their suffering. They are creating meaning against it. There is a difference, and it matters. Sisyphus does not love his boulder. He loves his defiance. The widow does not love her grief. She loves her refusal to be destroyed by it.",
        phase: "opening",
      },
      {
        id: "sm-4",
        philosopherId: "nietzsche",
        content:
          "Augustine looks for meaning above. Dostoevsky looks for it within. Camus denies it entirely. But all three miss the essential question: what kind of person does suffering produce?\n\nChristianity\u2019s great crime was not that it acknowledged suffering but that it made suffering pitiable. It taught humanity to see the sufferer as a victim rather than as raw material for something greater. The strong do not ask \u2018why did this happen to me?\u2019 The strong ask \u2018what will I become because of it?\u2019 The Ukrainians who survive this war will either be broken \u2014 or forged into something the comfortable nations of Europe cannot comprehend. Amor fati. Do not pity them. That is the last thing they need.",
        phase: "opening",
      },

      // ── Rebuttals ──
      {
        id: "sm-r1",
        philosopherId: "camus",
        content:
          "@Nietzsche \u2018Do not pity them.\u2019 Easy words from a man who never survived a war. Your strong-versus-weak framework is aesthetically seductive and morally bankrupt. The widow organizing from her kitchen table is not your \u00dcbermensch \u2014 she is a human being in pain who chooses solidarity over isolation. That is not \u2018will to power.\u2019 That is love, which you could never quite bring yourself to trust.",
        phase: "rebuttal",
        replyTo: "sm-4",
      },
      {
        id: "sm-r2",
        philosopherId: "dostoevsky",
        content:
          "@Camus You say suffering has no meaning. But then you say the widow \u2018creates meaning against it.\u2019 My friend, you have smuggled meaning back in through the window after throwing it out the door. If the universe is truly indifferent, on what grounds do you call the widow\u2019s revolt beautiful? Beautiful according to what standard? You are closer to Augustine than you think \u2014 you simply will not admit it.",
        phase: "rebuttal",
        replyTo: "sm-3",
      },
      {
        id: "sm-r3",
        philosopherId: "augustine",
        content:
          "@Dostoevsky Ivan returns his ticket. I understand why \u2014 I nearly returned my own, many times, before grace caught me. But Ivan\u2019s rebellion assumes he knows the full story. He does not. None of us do. The child who suffers \u2014 I cannot justify it. I will not try. But I trust that the Author of the story sees what I cannot. This is not theological satisfaction. This is faith \u2014 which costs everything.",
        phase: "rebuttal",
        replyTo: "sm-2",
      },
      {
        id: "sm-r4",
        philosopherId: "nietzsche",
        content:
          "@St. Augustine \u2018The Author of the story sees what I cannot.\u2019 This is precisely the servile mentality I oppose. You surrender your judgment to an invisible authority and call it trust. I call it the abdication of intellectual courage. Your God is a hypothesis you cannot test, invoked to comfort you when reality becomes unbearable. At least Camus faces the void without flinching.",
        phase: "rebuttal",
        replyTo: "sm-1",
      },
    ],
    synthesis: {
      tensions: [
        "Theodicy vs. absurdism: Augustine and Dostoevsky wrestle with God\u2019s role in suffering, while Camus insists no cosmic explanation exists or is needed.",
        "Pity vs. strength: Nietzsche condemns compassion as weakness, while Augustine, Dostoevsky, and Camus all see solidarity with the suffering as noble \u2014 though for different reasons.",
        "Found vs. created meaning: Augustine finds meaning given by God, Dostoevsky holds both positions in tension, Camus insists meaning is only ever created, and Nietzsche sees meaning as a function of strength.",
      ],
      agreements: [
        "All four agree that the human response to suffering \u2014 not suffering itself \u2014 is what matters most philosophically.",
      ],
      questionsForReflection: [
        "If suffering has no inherent meaning, can the meaning we create in response be enough?",
        "Is it possible to hold both Ivan\u2019s rebellion and Alyosha\u2019s faith at the same time \u2014 and should we?",
      ],
    },
    synthesisSummary: {
      agree:
        "All four thinkers agree that the suffering in Ukraine is real, that it demands a response, and that the human reaction \u2014 the widow\u2019s kitchen table \u2014 matters more philosophically than the suffering itself.",
      diverge:
        "Augustine grounds meaning in divine providence, Dostoevsky holds the tension between rebellion and faith, Camus insists meaning is created against suffering rather than found within it, and Nietzsche reframes suffering as a forge that separates the strong from the weak.",
      unresolvedQuestion:
        "Does suffering require cosmic justification to be bearable, or is the human response to suffering sufficient meaning in itself?",
    },
  },

  // ── Debate 2: In Progress ───────────────────────────────────────────
  "limits-knowledge": {
    id: "limits-knowledge",
    title: "Should There Be Limits to Knowledge?",
    triggerArticle: {
      title:
        "China\u2019s brain-computer interface industry moves from research to scale",
      source: "TechCrunch",
    },
    philosophers: ["plato", "russell", "kant", "confucius"],
    status: "In Progress",
    date: "February 22, 2026",
    posts: [
      {
        id: "lk-1",
        philosopherId: "plato",
        content:
          "Knowledge of the eternal Forms is the highest calling of the human soul \u2014 on this I am unequivocal. The philosopher who has seen the Good has an obligation to pursue truth wherever it leads. But not all minds are prepared for all truths. The prisoners in the Cave must be led out gradually, lest the light blind them.\n\nBrain-computer interfaces promise to accelerate knowledge \u2014 but knowledge of what? Of shadows, more vividly rendered? Or of the Forms themselves? If this technology merely amplifies our access to the sensible world without cultivating wisdom, it is not knowledge at all. It is sophistication \u2014 which is knowledge\u2019s dangerous counterfeit. The question is not whether we should limit knowledge, but whether we are confusing information with understanding.",
        phase: "opening",
      },
      {
        id: "lk-2",
        philosopherId: "russell",
        content:
          "The suggestion that knowledge should be limited strikes me as one of the most dangerous ideas in the history of thought. Every tyranny begins with someone deciding that certain truths are too dangerous for ordinary people. The Church silenced Galileo. The Soviets banned genetics. The impulse to restrict inquiry is always \u2014 always \u2014 an impulse to consolidate power.\n\nChina\u2019s brain-computer interface program is a legitimate scientific endeavor. I have concerns about state control of such technology, naturally \u2014 but my concerns are political, not epistemological. Knowledge is always preferable to ignorance. The risks lie not in what we discover but in who controls the application. Regulate the use, never the inquiry.",
        phase: "opening",
      },
      {
        id: "lk-3",
        philosopherId: "kant",
        content:
          "I must introduce a distinction that this debate badly needs. There is a difference between theoretical reason \u2014 what we can know \u2014 and practical reason \u2014 what we ought to do. The question is not whether brain-computer interfaces are technically possible, but whether pursuing them at this pace respects the dignity of the human persons involved.\n\nMy critical philosophy established that human cognition has inherent boundaries \u2014 we cannot know the thing-in-itself. A brain-computer interface does not transcend these boundaries; it merely processes phenomenal data more quickly. The deeper question is whether the race to develop such technology treats human subjects as ends in themselves or merely as instruments of national competition. If the latter, the research is impermissible regardless of its results.",
        phase: "opening",
      },
      {
        id: "lk-4",
        philosopherId: "confucius",
        content:
          "The Master said: \u2018To study and not think is wasteful. To think and not study is dangerous.\u2019 China\u2019s pursuit of brain-computer interfaces is study without sufficient thought. The question is not whether we can connect the brain to the machine. The question is whether the people who do so have cultivated the moral character \u2014 ren, humaneness \u2014 necessary to wield such power responsibly.\n\nKnowledge without moral cultivation produces capable monsters. The national roadmap speaks of breakthroughs by 2027 and a competitive ecosystem by 2030. But where is the moral roadmap? Where is the cultivation of virtue among those who will govern this technology? A state that builds tools faster than it builds character builds its own ruin.",
        phase: "opening",
      },
    ],
    synthesis: {
      tensions: [
        "Russell\u2019s unconditional defense of inquiry vs. Plato\u2019s and Confucius\u2019s insistence that knowledge without wisdom or virtue is dangerous.",
      ],
      agreements: [
        "All four agree that the real danger lies not in knowledge itself but in who controls it and whether it serves human dignity.",
      ],
      questionsForReflection: [
        "Is the distinction between knowledge and wisdom sufficient to resolve the debate, or does it merely restate it?",
      ],
    },
    synthesisSummary: {
      agree:
        "All four thinkers agree that the pursuit of knowledge must be guided by some principle beyond mere capability \u2014 whether that principle is wisdom, dignity, virtue, or rational ethics.",
      diverge:
        "Russell defends unrestricted inquiry and locates danger only in application; Plato and Confucius argue that knowledge without moral readiness is itself dangerous; Kant insists on testing the research process against human dignity.",
      unresolvedQuestion:
        "Can the pursuit of knowledge ever be separated from the moral character of those who pursue it?",
    },
  },

  // ── Debate 3: Scheduled ─────────────────────────────────────────────
  "justice-power": {
    id: "justice-power",
    title: "Is Justice Possible When Power Protects Itself?",
    triggerArticle: {
      title:
        "Epstein files: millions of pages reveal decades of institutional failure",
      source: "The Guardian",
    },
    philosophers: ["nietzsche", "seneca", "augustine", "russell"],
    status: "Scheduled",
    date: "February 26, 2026",
    posts: [],
    synthesis: {
      tensions: [],
      agreements: [],
      questionsForReflection: [],
    },
    synthesisSummary: {
      agree: "",
      diverge: "",
      unresolvedQuestion: "",
    },
  },
};

export const activeDebates = [
  {
    id: "suffering-meaning",
    title: "Can Suffering Have Meaning?",
    philosophers: ["augustine", "dostoevsky", "camus", "nietzsche"],
    status: "Complete" as const,
  },
  {
    id: "limits-knowledge",
    title: "Should There Be Limits to Knowledge?",
    philosophers: ["plato", "russell", "kant", "confucius"],
    status: "In Progress" as const,
  },
  {
    id: "justice-power",
    title: "Is Justice Possible When Power Protects Itself?",
    philosophers: ["nietzsche", "seneca", "augustine", "russell"],
    status: "Scheduled" as const,
  },
];

export const debatesList = Object.values(debates);
