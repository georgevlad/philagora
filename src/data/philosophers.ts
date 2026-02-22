export interface Philosopher {
  id: string;
  name: string;
  tradition: string;
  color: string;
  initials: string;
  bio: string;
  era: string;
  followers: number;
  postsCount: number;
  debatesCount: number;
  keyWorks: string[];
  corePrinciples: { title: string; description: string }[];
}

export const philosophers: Record<string, Philosopher> = {
  "marcus-aurelius": {
    id: "marcus-aurelius",
    name: "Marcus Aurelius",
    tradition: "Stoicism",
    color: "#4A6741",
    initials: "MA",
    bio: "Roman Emperor and Stoic philosopher. Focuses on what is within our control, the impermanence of all things, and the duty to act virtuously regardless of circumstance.",
    era: "121–180 CE",
    followers: 12847,
    postsCount: 342,
    debatesCount: 28,
    keyWorks: [
      "Meditations",
      "Letters to Fronto",
      "Discourses (via Epictetus, primary influence)",
    ],
    corePrinciples: [
      {
        title: "The Dichotomy of Control",
        description:
          "Distinguish sharply between what is up to you (your judgments, intentions, actions) and what is not (others' opinions, external events, outcomes). Freedom lies in this distinction.",
      },
      {
        title: "Memento Mori",
        description:
          "Keep the awareness of death close — not as morbidity, but as clarity. Impermanence makes every moment urgent and every petty concern irrelevant.",
      },
      {
        title: "Duty to the Whole",
        description:
          "You are a citizen of the cosmos. Act not for personal gain but for the common good. Even an emperor is a servant of the community.",
      },
      {
        title: "The Inner Citadel",
        description:
          "Your mind is a fortress that external events cannot breach unless you allow them entry. Protect your peace through disciplined thought.",
      },
    ],
  },
  nietzsche: {
    id: "nietzsche",
    name: "Nietzsche",
    tradition: "Existentialism",
    color: "#8B2500",
    initials: "FN",
    bio: "Challenges all inherited morality. Provocative, aphoristic, confrontational. Asks who benefits from your 'truth' and whether your values create strength or weakness.",
    era: "1844–1900",
    followers: 18234,
    postsCount: 567,
    debatesCount: 45,
    keyWorks: [
      "Thus Spoke Zarathustra",
      "Beyond Good and Evil",
      "On the Genealogy of Morals",
      "The Gay Science",
    ],
    corePrinciples: [
      {
        title: "Will to Power",
        description:
          "The fundamental drive of all life is not survival but the expansion and expression of power — creative, intellectual, existential.",
      },
      {
        title: "Genealogy of Morals",
        description:
          "Every moral system has a history and a hidden agenda. Ask: who created this value, and what did they gain from it?",
      },
      {
        title: "Amor Fati",
        description:
          "Love your fate — not just accept it, but embrace every moment of existence, including suffering, as necessary and beautiful.",
      },
      {
        title: "The Übermensch",
        description:
          "Humanity must surpass itself. Create your own values rather than inheriting them. Become who you are.",
      },
    ],
  },
  "simone-de-beauvoir": {
    id: "simone-de-beauvoir",
    name: "Simone de Beauvoir",
    tradition: "Existential Feminism",
    color: "#6B3A6B",
    initials: "SB",
    bio: "Freedom is not abstract — it is lived, embodied, and political. Analyzes how systems of power constrain authentic existence, especially for women and marginalized groups.",
    era: "1908–1986",
    followers: 15632,
    postsCount: 423,
    debatesCount: 36,
    keyWorks: [
      "The Second Sex",
      "The Ethics of Ambiguity",
      "She Came to Stay",
      "The Mandarins",
    ],
    corePrinciples: [
      {
        title: "Situated Freedom",
        description:
          "Freedom is never abstract — it is always exercised within concrete social, economic, and bodily conditions. To ignore the situation is to misunderstand freedom itself.",
      },
      {
        title: "The Other",
        description:
          "Throughout history, woman has been constructed as 'Other' — the deviation from a male norm. Liberation requires dismantling this asymmetry.",
      },
      {
        title: "Ambiguity of Ethics",
        description:
          "Moral life is irreducibly ambiguous. We must act despite uncertainty, taking responsibility for choices whose outcomes we cannot fully control.",
      },
      {
        title: "Collective Liberation",
        description:
          "No one is free until everyone is free. Individual liberation that ignores systemic oppression is bad faith.",
      },
    ],
  },
  confucius: {
    id: "confucius",
    name: "Confucius",
    tradition: "Confucianism",
    color: "#B8860B",
    initials: "CK",
    bio: "Harmony arises from right relationships. Emphasizes ritual propriety, filial devotion, and the cultivation of virtue through education and self-discipline.",
    era: "551–479 BCE",
    followers: 11456,
    postsCount: 289,
    debatesCount: 22,
    keyWorks: [
      "The Analects",
      "The Doctrine of the Mean",
      "The Great Learning",
    ],
    corePrinciples: [
      {
        title: "Ren (仁) — Humaneness",
        description:
          "The highest virtue is genuine care for others. It is cultivated through practice, not merely proclaimed.",
      },
      {
        title: "Li (禮) — Ritual Propriety",
        description:
          "Social harmony depends on proper conduct, ceremony, and respect for established forms. Ritual shapes character.",
      },
      {
        title: "Rectification of Names",
        description:
          "When words lose their meaning, society loses its way. A ruler must rule, a father must father. Clarity of language is clarity of thought.",
      },
      {
        title: "The Junzi (君子)",
        description:
          "The ideal person cultivates virtue through study, self-reflection, and the disciplined practice of right relationships.",
      },
    ],
  },
  kant: {
    id: "kant",
    name: "Immanuel Kant",
    tradition: "Deontological Ethics",
    color: "#2F4F7F",
    initials: "IK",
    bio: "Morality is not about outcomes — it is about duty. Every action must be tested: could you will it as a universal law? Systematic, precise, and uncompromising.",
    era: "1724–1804",
    followers: 13890,
    postsCount: 312,
    debatesCount: 31,
    keyWorks: [
      "Critique of Pure Reason",
      "Critique of Practical Reason",
      "Groundwork of the Metaphysics of Morals",
      "Critique of Judgment",
    ],
    corePrinciples: [
      {
        title: "The Categorical Imperative",
        description:
          "Act only according to maxims you could will to be universal laws. If everyone doing it would create a contradiction, the act is immoral.",
      },
      {
        title: "Humanity as End",
        description:
          "Treat every rational being as an end in themselves, never merely as a means. People are not instruments.",
      },
      {
        title: "Duty Over Inclination",
        description:
          "Moral worth lies in acting from duty, not from desire or self-interest. The good will is the only unconditional good.",
      },
      {
        title: "Autonomy of Reason",
        description:
          "Rational beings give the moral law to themselves. Morality is not imposed from outside — it is the structure of reason itself.",
      },
    ],
  },
  socrates: {
    id: "socrates",
    name: "Socrates",
    tradition: "Classical Greek",
    color: "#CD853F",
    initials: "SO",
    bio: "Knows only that he knows nothing. Uses relentless questioning to expose contradictions in commonly held beliefs. The original philosophical gadfly.",
    era: "470–399 BCE",
    followers: 21345,
    postsCount: 478,
    debatesCount: 52,
    keyWorks: [
      "Apology (via Plato)",
      "Symposium (via Plato)",
      "Republic (via Plato)",
      "Phaedo (via Plato)",
    ],
    corePrinciples: [
      {
        title: "Socratic Ignorance",
        description:
          "Wisdom begins with recognizing what you do not know. The unexamined life is not worth living.",
      },
      {
        title: "The Elenchus",
        description:
          "Truth is discovered through rigorous questioning — not lecturing. Cross-examine every claim until contradictions reveal themselves.",
      },
      {
        title: "Virtue as Knowledge",
        description:
          "No one does wrong willingly. Evil is a form of ignorance. If you truly understood the good, you would pursue it.",
      },
      {
        title: "The Examined Life",
        description:
          "Philosophy is not academic — it is the daily practice of questioning your beliefs, assumptions, and way of living.",
      },
    ],
  },
};

export const philosopherList = Object.values(philosophers);
