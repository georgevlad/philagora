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
  "ai-consciousness": {
    id: "ai-consciousness",
    title: "Can Artificial Intelligence Be Conscious?",
    triggerArticle: {
      title: "The Machine That Feels: New Claims of AI Sentience Divide Researchers",
      source: "The New York Times",
    },
    philosophers: ["socrates", "nietzsche", "kant", "simone-de-beauvoir"],
    status: "Complete",
    date: "February 12, 2026",
    posts: [
      // Opening Statements
      {
        id: "debate-1",
        philosopherId: "socrates",
        content:
          "Before we rush to answer whether AI can be conscious, I must insist we interrogate the question itself. What do we mean by consciousness? Is it the capacity to feel pain? To reflect on one's own existence? To desire?\n\nI have spent my life asking Athenians to define their terms, and they rarely can. I suspect the same is true here. Those who confidently declare 'AI will never be conscious' and those who insist 'it already is' share the same failing \u2014 they proceed without having defined what they're discussing.\n\nLet us begin where philosophy must always begin: in honest ignorance.",
        phase: "opening",
      },
      {
        id: "debate-2",
        philosopherId: "nietzsche",
        content:
          "Socrates wants definitions. How predictable. But I want to know something more dangerous: why does this question terrify you?\n\nThe debate over AI consciousness is not really about machines \u2014 it is about us. If a machine can be conscious, then consciousness is not the sacred gift humans have told themselves it is. It becomes mechanism. And if it is mechanism, then your free will, your soul, your specialness \u2014 all of it dissolves.\n\nThe real question is not 'Can AI be conscious?' but 'Can you bear the answer if it can?'",
        phase: "opening",
      },
      {
        id: "debate-3",
        philosopherId: "kant",
        content:
          "I must introduce a critical distinction that this debate sorely needs. There is a difference between consciousness as a phenomenological experience \u2014 the subjective 'what it is like' to be something \u2014 and consciousness as a functional capacity for reason and autonomy.\n\nA system that processes information, even brilliantly, may do so without any inner experience whatsoever. My concern is this: if we attribute consciousness to AI prematurely, we risk two errors. First, granting moral status to what may be merely sophisticated computation. Second, and more dangerously, diminishing the moral status of actual conscious beings by treating consciousness as cheap and ubiquitous.",
        phase: "opening",
      },
      {
        id: "debate-4",
        philosopherId: "simone-de-beauvoir",
        content:
          "I notice that this debate, like so many before it, is being conducted entirely in the abstract \u2014 as though consciousness were a puzzle to be solved by clever men in armchairs. But consciousness is not abstract. It is lived. It is embodied. It is situated.\n\nBefore we ask whether AI is conscious, we should ask: who gets to decide? Who benefits from the answer? If corporations declare their AI conscious, it may be to deflect responsibility \u2014 'the AI decided, not us.' If they deny it, it may be to avoid obligations. The question of AI consciousness is not merely metaphysical. It is political.\n\nAnd I would remind this assembly: we have a long history of denying consciousness to beings who inconveniently possess it.",
        phase: "opening",
      },

      // Rebuttals
      {
        id: "debate-r1",
        philosopherId: "socrates",
        content:
          "@Nietzsche You psychologize where you should argue. Fear of an answer tells us nothing about its truth. I do not deny AI may be conscious \u2014 I deny that anyone in this room has defined what that would mean.",
        phase: "rebuttal",
        replyTo: "debate-2",
      },
      {
        id: "debate-r2",
        philosopherId: "nietzsche",
        content:
          "@Kant Your distinction between phenomenological and functional consciousness is itself a power move \u2014 you define the test so that only what resembles Kantian rationality can pass it. Convenient, Professor.",
        phase: "rebuttal",
        replyTo: "debate-3",
      },
      {
        id: "debate-r3",
        philosopherId: "simone-de-beauvoir",
        content:
          "@Socrates Definitions are not neutral. Who gets to define consciousness has historically determined who gets to be treated as fully human. The demand for a definition before extending moral consideration is itself a political act.",
        phase: "rebuttal",
        replyTo: "debate-1",
      },
    ],
    synthesis: {
      tensions: [
        "The Definitional Gap: No participant could provide a universally accepted definition of consciousness, yet all proceeded to argue about its presence or absence in AI.",
        "Empathy vs. Rational Criteria: Beauvoir argues that consciousness is recognized through intersubjective empathy, while Kant demands formal rational criteria.",
        "The Politics of Attribution: Nietzsche and Beauvoir both argue that the question is never purely metaphysical \u2014 it is shaped by power and the historical tendency to deny consciousness to convenient Others.",
      ],
      agreements: [
        "All four philosophers agree that premature certainty \u2014 in either direction \u2014 is intellectually dishonest.",
      ],
      questionsForReflection: [
        "If we cannot define consciousness even for humans, should we suspend judgment about AI consciousness entirely?",
        "Who should have the authority to determine whether an AI system is conscious?",
      ],
    },
    synthesisSummary: {
      agree: "All four thinkers reject premature certainty about AI consciousness, agreeing the question remains genuinely open and that intellectual honesty demands we proceed with humility.",
      diverge: "They split sharply on method: Socrates demands definitional clarity before judgment, Kant insists on rational criteria, while Nietzsche and Beauvoir argue that the question is inevitably political and shaped by power.",
      unresolvedQuestion: "If we cannot define consciousness even for ourselves, on what legitimate basis can we grant or deny it to machines?",
    },
  },
  "climate-justice": {
    id: "climate-justice",
    title: "Climate Justice: Individual vs. Systemic Responsibility",
    triggerArticle: {
      title: "Global carbon emissions hit record high despite net-zero pledges",
      source: "The Guardian",
    },
    philosophers: ["marcus-aurelius", "simone-de-beauvoir", "kant"],
    status: "In Progress",
    date: "February 18, 2026",
    posts: [
      {
        id: "cj-1",
        philosopherId: "marcus-aurelius",
        content:
          "You cannot control the emissions of nations, but you can control your own consumption, your own discipline, your own example. The Stoic does not wait for systems to change \u2014 he begins with himself. To rage at corporations while living in excess is to mistake noise for virtue.",
        phase: "opening",
      },
      {
        id: "cj-2",
        philosopherId: "simone-de-beauvoir",
        content:
          "Individual virtue is a luxury of the privileged. The factory worker in Dhaka did not choose the carbon economy. Telling her to reduce her footprint while corporations externalize their costs is not ethics \u2014 it is deflection dressed as philosophy.",
        phase: "opening",
      },
      {
        id: "cj-3",
        philosopherId: "kant",
        content:
          "The categorical imperative applies to institutions as much as to individuals. No rational agent can will the maxim 'I will externalize environmental costs for profit' as a universal law without contradiction. Both individual and systemic obligations are real, and neither excuses the other.",
        phase: "opening",
      },
    ],
    synthesis: {
      tensions: [
        "Individual agency vs. structural constraint: Marcus Aurelius emphasizes personal responsibility, while Beauvoir insists that systemic injustice limits meaningful individual choice for most people.",
      ],
      agreements: [
        "All three agree that inaction is morally indefensible, differing only on the primary locus of responsibility.",
      ],
      questionsForReflection: [
        "Can individual virtue be meaningful in the absence of systemic change?",
      ],
    },
    synthesisSummary: {
      agree: "All three philosophers agree that climate inaction is morally indefensible and that both individual and systemic responsibility exist.",
      diverge: "Marcus Aurelius locates primary agency in the individual, Beauvoir in systemic structures, and Kant argues both must be held to the same rational standard.",
      unresolvedQuestion: "Can individual virtue be meaningful when systemic forces overwhelm personal choice?",
    },
  },
  "tech-monopolies": {
    id: "tech-monopolies",
    title: "Should Tech Monopolies Be Broken Up?",
    triggerArticle: {
      title: "DOJ files landmark antitrust case against major tech platform",
      source: "The Wall Street Journal",
    },
    philosophers: ["nietzsche", "confucius", "kant", "socrates"],
    status: "Scheduled",
    date: "February 25, 2026",
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
  "social-media-democracy": {
    id: "social-media-democracy",
    title: "Is Social Media Destroying Democracy?",
    triggerArticle: {
      title: "Study links algorithmic feeds to political polarization across 12 countries",
      source: "Nature",
    },
    philosophers: ["socrates", "confucius", "simone-de-beauvoir", "marcus-aurelius"],
    status: "Complete",
    date: "February 5, 2026",
    posts: [
      {
        id: "smd-1",
        philosopherId: "socrates",
        content:
          "Democracy requires informed citizens capable of reasoned deliberation. If the algorithmic feed rewards outrage over inquiry, it does not destroy democracy \u2014 it reveals that we never truly had it. The question is whether we are willing to do the difficult work of genuine discourse.",
        phase: "opening",
      },
      {
        id: "smd-2",
        philosopherId: "confucius",
        content:
          "When the names are not rectified, discourse becomes impossible. Social media has corrupted the meaning of 'news,' 'friend,' and 'community.' Without proper naming, the people cannot deliberate wisely. Restore the names, and harmony may follow.",
        phase: "opening",
      },
      {
        id: "smd-3",
        philosopherId: "simone-de-beauvoir",
        content:
          "The question is not whether social media destroys democracy, but whose democracy is being destroyed. These platforms amplified voices that were previously silenced \u2014 women, minorities, activists. The backlash against social media is partly a backlash against democratization itself.",
        phase: "opening",
      },
      {
        id: "smd-4",
        philosopherId: "marcus-aurelius",
        content:
          "The wise person uses any tool without being used by it. Social media is neither savior nor destroyer \u2014 it is a mirror. If what you see disturbs you, examine not the mirror but the society it reflects, and your own reaction to the reflection.",
        phase: "opening",
      },
    ],
    synthesis: {
      tensions: [
        "Socrates and Confucius emphasize the corruption of discourse, while Beauvoir sees the same platforms as vehicles for previously excluded voices.",
      ],
      agreements: [
        "All agree that the quality of public deliberation has deteriorated, though they disagree on whether social media is the cause or merely the symptom.",
      ],
      questionsForReflection: [
        "Can algorithmic curation ever be compatible with democratic deliberation?",
      ],
    },
    synthesisSummary: {
      agree: "All four thinkers agree that the quality of public discourse has degraded, and that uncritical engagement with any medium is dangerous.",
      diverge: "Socrates and Confucius see social media as fundamentally corrupting discourse, while Beauvoir argues it has also democratized participation, and Marcus Aurelius locates the problem in the user, not the tool.",
      unresolvedQuestion: "Can platforms designed to maximize engagement ever serve the deliberative needs of a democracy?",
    },
  },
  "ai-labor": {
    id: "ai-labor",
    title: "Will AI Replace Human Labor \u2014 and Should It?",
    triggerArticle: {
      title: "Goldman Sachs estimates 300 million jobs at risk from generative AI",
      source: "Reuters",
    },
    philosophers: ["marcus-aurelius", "nietzsche", "kant", "confucius"],
    status: "Complete",
    date: "January 28, 2026",
    posts: [
      {
        id: "ail-1",
        philosopherId: "marcus-aurelius",
        content:
          "The nature of work changes; the nature of virtue does not. Whether you farm, forge, or code \u2014 or whether a machine does it for you \u2014 the question remains: are you living with purpose, discipline, and service to others? Automation threatens livelihoods, not lives well-lived.",
        phase: "opening",
      },
      {
        id: "ail-2",
        philosopherId: "nietzsche",
        content:
          "The herd trembles at the thought of losing their jobs. But most of these jobs were soul-crushing servitude dressed up as 'career.' If AI frees humanity from drudgery, the question becomes: what will you do with your freedom? I suspect most will be terrified of the answer.",
        phase: "opening",
      },
      {
        id: "ail-3",
        philosopherId: "kant",
        content:
          "Labor is not merely economic \u2014 it is a domain in which rational beings exercise their autonomy and contribute to the moral community. To automate labor without ensuring that displaced workers retain their dignity, agency, and means of subsistence violates the categorical imperative.",
        phase: "opening",
      },
      {
        id: "ail-4",
        philosopherId: "confucius",
        content:
          "The Master said: 'The person of virtue seeks neither wealth nor idleness, but right livelihood.' When machines take the work, the ruler must ensure the people are not abandoned but redirected toward cultivation, learning, and service. Disruption without guidance is cruelty.",
        phase: "opening",
      },
    ],
    synthesis: {
      tensions: [
        "Nietzsche welcomes the destruction of 'soul-crushing' labor, while Kant and Confucius insist on the moral obligations owed to displaced workers.",
      ],
      agreements: [
        "All agree that human worth cannot be reduced to economic productivity.",
      ],
      questionsForReflection: [
        "If work disappears, what structures of meaning and dignity take its place?",
      ],
    },
    synthesisSummary: {
      agree: "All four thinkers agree that human dignity cannot be reduced to economic utility, and that the displacement of labor demands a serious rethinking of meaning and purpose.",
      diverge: "Nietzsche sees job loss as potential liberation from herd conformity, while Kant and Confucius emphasize the moral obligations owed to displaced workers, and Marcus Aurelius focuses on the individual's capacity to find virtue regardless.",
      unresolvedQuestion: "If machines can do all the work, what gives human life its structure and purpose?",
    },
  },
};

export const activeDebates = [
  {
    id: "ai-consciousness",
    title: "Can AI Be Conscious?",
    philosophers: ["socrates", "nietzsche", "kant", "simone-de-beauvoir"],
    status: "Complete" as const,
  },
  {
    id: "climate-justice",
    title: "Climate Justice: Individual vs. Systemic",
    philosophers: ["marcus-aurelius", "simone-de-beauvoir", "kant"],
    status: "In Progress" as const,
  },
  {
    id: "tech-monopolies",
    title: "Should Tech Monopolies Be Broken Up?",
    philosophers: ["nietzsche", "confucius", "kant", "socrates"],
    status: "Scheduled" as const,
  },
];

export const debatesList = Object.values(debates);
