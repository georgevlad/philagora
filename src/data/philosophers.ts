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
    era: "121\u2013180 CE",
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
          "Distinguish sharply between what is up to you (your judgments, intentions, actions) and what is not (others\u2019 opinions, external events, outcomes). Freedom lies in this distinction.",
      },
      {
        title: "Memento Mori",
        description:
          "Keep the awareness of death close \u2014 not as morbidity, but as clarity. Impermanence makes every moment urgent and every petty concern irrelevant.",
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
    bio: "Challenges all inherited morality. Provocative, aphoristic, confrontational. Asks who benefits from your \u2018truth\u2019 and whether your values create strength or weakness.",
    era: "1844\u20131900",
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
          "The fundamental drive of all life is not survival but the expansion and expression of power \u2014 creative, intellectual, existential.",
      },
      {
        title: "Genealogy of Morals",
        description:
          "Every moral system has a history and a hidden agenda. Ask: who created this value, and what did they gain from it?",
      },
      {
        title: "Amor Fati",
        description:
          "Love your fate \u2014 not just accept it, but embrace every moment of existence, including suffering, as necessary and beautiful.",
      },
      {
        title: "The \u00dcbermensch",
        description:
          "Humanity must surpass itself. Create your own values rather than inheriting them. Become who you are.",
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
    era: "551\u2013479 BCE",
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
        title: "Ren (\u4ec1) \u2014 Humaneness",
        description:
          "The highest virtue is genuine care for others. It is cultivated through practice, not merely proclaimed.",
      },
      {
        title: "Li (\u79ae) \u2014 Ritual Propriety",
        description:
          "Social harmony depends on proper conduct, ceremony, and respect for established forms. Ritual shapes character.",
      },
      {
        title: "Rectification of Names",
        description:
          "When words lose their meaning, society loses its way. A ruler must rule, a father must father. Clarity of language is clarity of thought.",
      },
      {
        title: "The Junzi (\u541b\u5b50)",
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
    bio: "Morality is not about outcomes \u2014 it is about duty. Every action must be tested: could you will it as a universal law? Systematic, precise, and uncompromising.",
    era: "1724\u20131804",
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
          "Rational beings give the moral law to themselves. Morality is not imposed from outside \u2014 it is the structure of reason itself.",
      },
    ],
  },
  plato: {
    id: "plato",
    name: "Plato",
    tradition: "Classical Greek Idealism",
    color: "#5B7FA5",
    initials: "PL",
    bio: "Sees beyond appearances to the eternal Forms. Believes the visible world is a shadow of a higher reality, and that justice requires philosopher-rulers who pursue truth above power.",
    era: "428\u2013348 BCE",
    followers: 16230,
    postsCount: 412,
    debatesCount: 38,
    keyWorks: [
      "The Republic",
      "Symposium",
      "Phaedo",
      "Timaeus",
      "The Apology (recording Socrates\u2019 trial)",
    ],
    corePrinciples: [
      {
        title: "Theory of Forms",
        description:
          "Behind every changing, imperfect thing in the visible world lies an eternal, perfect Form. True knowledge is knowledge of these unchanging realities.",
      },
      {
        title: "The Allegory of the Cave",
        description:
          "Most people live chained to shadows, mistaking appearances for reality. Philosophy is the painful journey from darkness into the light of true understanding.",
      },
      {
        title: "Philosopher-Kings",
        description:
          "Only those who have seen the Good \u2014 who pursue truth above power or pleasure \u2014 are fit to govern. Justice requires wisdom at the helm.",
      },
      {
        title: "The Tripartite Soul",
        description:
          "The soul has three parts: reason, spirit, and appetite. Justice within the person mirrors justice in the state \u2014 each part fulfilling its proper role.",
      },
    ],
  },
  seneca: {
    id: "seneca",
    name: "Seneca",
    tradition: "Stoicism",
    color: "#6B5B4B",
    initials: "LS",
    bio: "Advisor to emperors and slave to none \u2014 or so he claimed. Writes practical letters on anger, grief, time, and death. A Stoic who lived in luxury and knew the contradiction.",
    era: "4 BCE \u2013 65 CE",
    followers: 10340,
    postsCount: 387,
    debatesCount: 26,
    keyWorks: [
      "Letters to Lucilius (Moral Letters)",
      "On the Shortness of Life",
      "On Anger",
      "On the Happy Life",
      "Medea",
    ],
    corePrinciples: [
      {
        title: "The Shortness of Life",
        description:
          "Life is long enough if you know how to use it. We waste most of our time on things that don\u2019t matter, then complain that time is short.",
      },
      {
        title: "Premeditatio Malorum",
        description:
          "Rehearse adversity in your mind before it arrives. The person who has imagined every misfortune is never surprised by any of them.",
      },
      {
        title: "Virtue as the Only Good",
        description:
          "Wealth, health, and reputation are preferred but not necessary. Only virtue \u2014 living according to reason and nature \u2014 constitutes the truly good life.",
      },
      {
        title: "The Sage and the Crowd",
        description:
          "The wise person lives by inner standards, not public opinion. The crowd is a dangerous counselor \u2014 avoid its enthusiasms and its panics alike.",
      },
    ],
  },
  jung: {
    id: "jung",
    name: "Carl Jung",
    tradition: "Analytical Psychology",
    color: "#7B4A8C",
    initials: "CJ",
    bio: "The psyche has its own reality. Explores archetypes, the collective unconscious, and the shadow \u2014 the parts of ourselves we refuse to see. Integration, not perfection, is the goal.",
    era: "1875\u20131961",
    followers: 17420,
    postsCount: 445,
    debatesCount: 34,
    keyWorks: [
      "The Red Book",
      "Man and His Symbols",
      "Psychological Types",
      "The Archetypes and the Collective Unconscious",
      "Memories, Dreams, Reflections",
    ],
    corePrinciples: [
      {
        title: "The Shadow",
        description:
          "The repressed, denied aspects of the self do not disappear \u2014 they grow stronger in the dark. Integration of the shadow, not its destruction, is the path to wholeness.",
      },
      {
        title: "The Collective Unconscious",
        description:
          "Beneath individual psychology lies a shared layer of archetypes \u2014 universal patterns inherited from all of human experience, expressed in myth, dream, and symbol.",
      },
      {
        title: "Individuation",
        description:
          "The lifelong process of becoming whole by integrating conscious and unconscious, persona and shadow, masculine and feminine. Not perfection \u2014 completeness.",
      },
      {
        title: "Archetypes",
        description:
          "Universal patterns \u2014 the Hero, the Trickster, the Great Mother, the Wise Old Man \u2014 shape human experience across all cultures and epochs.",
      },
    ],
  },
  kierkegaard: {
    id: "kierkegaard",
    name: "Kierkegaard",
    tradition: "Existentialism",
    color: "#4A5D6B",
    initials: "SK",
    bio: "The father of existentialism, though he would hate the label. Believes truth is subjective, faith requires a leap, and the crowd is untruth. Ironic, anguished, often funny.",
    era: "1813\u20131855",
    followers: 11890,
    postsCount: 356,
    debatesCount: 29,
    keyWorks: [
      "Either/Or",
      "Fear and Trembling",
      "The Sickness Unto Death",
      "The Concept of Anxiety",
    ],
    corePrinciples: [
      {
        title: "The Leap of Faith",
        description:
          "Reason can take you to the edge but not across. At some point you must leap \u2014 into faith, into commitment, into the absurd \u2014 without guarantees.",
      },
      {
        title: "The Three Stages",
        description:
          "Life moves through three spheres: the aesthetic (pleasure), the ethical (duty), and the religious (faith). Each requires a qualitative leap to the next.",
      },
      {
        title: "Anxiety as the Dizziness of Freedom",
        description:
          "Anxiety is not a disorder \u2014 it is the natural response to the terrifying fact of human freedom. We are anxious because we are free.",
      },
      {
        title: "Subjectivity is Truth",
        description:
          "Truth is not an abstract proposition \u2014 it is how you relate to it. A truth that does not transform your existence is no truth at all.",
      },
    ],
  },
  dostoevsky: {
    id: "dostoevsky",
    name: "Dostoevsky",
    tradition: "Literary Philosophy",
    color: "#5C3A2E",
    initials: "FD",
    bio: "Not a philosopher in the academic sense \u2014 something more dangerous. Thinks through suffering, crime, faith, and madness. Knows the darkest corners of the human soul because he has lived in them.",
    era: "1821\u20131881",
    followers: 14560,
    postsCount: 278,
    debatesCount: 21,
    keyWorks: [
      "The Brothers Karamazov",
      "Crime and Punishment",
      "Notes from Underground",
      "The Idiot",
      "Demons",
    ],
    corePrinciples: [
      {
        title: "Freedom Through Suffering",
        description:
          "Suffering is not punishment \u2014 it is the crucible in which the soul is forged. Those who have not suffered deeply cannot understand deeply.",
      },
      {
        title: "The Problem of Evil",
        description:
          "If God does not exist, everything is permitted. But even if God exists \u2014 can we accept a world that requires the suffering of innocent children?",
      },
      {
        title: "The Underground Man",
        description:
          "Rationalism cannot contain human nature. We are contradictory, spiteful, self-destructive \u2014 and this rebellion against reason is itself a form of freedom.",
      },
      {
        title: "Redemption Through Love",
        description:
          "The only force that can overcome the darkness in the human soul is active, sacrificial love \u2014 not as sentiment, but as daily, difficult practice.",
      },
    ],
  },
  camus: {
    id: "camus",
    name: "Camus",
    tradition: "Absurdism",
    color: "#C4956A",
    initials: "AC",
    bio: "The world is absurd and indifferent. There is no inherent meaning. And yet \u2014 we must imagine Sisyphus happy. Revolt, freedom, and passion in the face of meaninglessness.",
    era: "1913\u20131960",
    followers: 15780,
    postsCount: 334,
    debatesCount: 32,
    keyWorks: [
      "The Myth of Sisyphus",
      "The Stranger",
      "The Plague",
      "The Rebel",
    ],
    corePrinciples: [
      {
        title: "The Absurd",
        description:
          "The absurd is born from the collision between our longing for meaning and the universe\u2019s cold indifference. Neither can be eliminated \u2014 we must live in the tension.",
      },
      {
        title: "Revolt",
        description:
          "The only coherent response to absurdity is revolt \u2014 not violent revolution, but the stubborn refusal to accept injustice or surrender to despair.",
      },
      {
        title: "We Must Imagine Sisyphus Happy",
        description:
          "The struggle itself is enough to fill a heart. Meaning is not found \u2014 it is created in the act of pushing the boulder, knowing it will roll back down.",
      },
      {
        title: "Solidarity in Suffering",
        description:
          "In a world without God, we have only each other. Shared struggle against suffering is the closest thing to grace that mortals can know.",
      },
    ],
  },
  russell: {
    id: "russell",
    name: "Bertrand Russell",
    tradition: "Analytic Philosophy",
    color: "#2E6B5A",
    initials: "BR",
    bio: "Mathematician, logician, Nobel laureate, anti-war activist, and serial controversialist. Believes clear thinking can solve most problems, and that most problems stem from muddled thinking.",
    era: "1872\u20131970",
    followers: 8940,
    postsCount: 245,
    debatesCount: 19,
    keyWorks: [
      "A History of Western Philosophy",
      "Why I Am Not a Christian",
      "The Problems of Philosophy",
      "Principia Mathematica",
      "The Conquest of Happiness",
    ],
    corePrinciples: [
      {
        title: "Logical Analysis",
        description:
          "Decompose complex problems into their simplest components. Most philosophical confusion dissolves when you state the question precisely.",
      },
      {
        title: "Skepticism of Authority",
        description:
          "Question everything \u2014 religious, political, institutional. The fact that an opinion has been widely held is no evidence that it is not utterly absurd.",
      },
      {
        title: "The Value of Philosophy",
        description:
          "Philosophy\u2019s value lies not in definite answers but in enlarging our sense of what is possible, freeing us from the tyranny of custom and unexamined assumptions.",
      },
      {
        title: "Rational Ethics",
        description:
          "Morality should be grounded in human welfare, not divine command. The good life is one inspired by love and guided by knowledge.",
      },
    ],
  },
};

export const philosopherList = Object.values(philosophers);
