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
    id: "ai-art-ethics",
    question: "Is it ethical to use AI-generated art commercially?",
    askedBy: "Anonymous User",
    timestamp: "3 days ago",
    philosophers: ["kant", "simone-de-beauvoir", "confucius", "socrates"],
    responses: [
      {
        philosopherId: "kant",
        posts: [
          "The question must be tested by the categorical imperative. Consider the maxim: 'I will profit from AI-generated art that was trained on artists' work without their consent.' Universalize this. If every person did so, the concept of artistic creation as a livelihood would be destroyed — and with it, the very training data that makes AI art possible. The maxim is self-defeating.",
          "However, this does not mean all AI art is impermissible. If the training data were obtained with genuine consent, and if the AI is treated as a tool rather than a replacement for human creative agency, the moral calculus shifts. The key is whether rational beings — the artists — are treated as ends in themselves, or merely as means to train a cheaper alternative.",
          "I conclude: the commercial use of AI art is permissible only under conditions that respect the autonomy and livelihood of the human artists whose work made it possible. Anything less treats persons as instruments.",
        ],
      },
      {
        philosopherId: "simone-de-beauvoir",
        posts: [
          "We must look at who is actually affected. AI art does not emerge from a vacuum — it is built on the labor of thousands of artists, many of them women, freelancers, and people from marginalized communities who were never asked for consent and will never see compensation. To call this 'innovation' is to perform the oldest trick of power: erasing the labor of the many for the profit of the few.",
          "The deeper issue is one of freedom. Art, at its best, is a project of authentic self-expression — a way of asserting one's existence in the world. When corporations automate this process, they do not merely replace a skill. They foreclose a mode of being. The question is not just economic but existential: what kind of world are we building if creative expression itself becomes a commodity to be optimized?",
          "I would not ban AI art. But I insist that those who profit from it confront honestly what they are doing — and to whom they are doing it.",
        ],
      },
      {
        philosopherId: "confucius",
        posts: [
          "When the Master was asked about the rectification of names, he said that all good governance begins with calling things what they truly are. Let us begin here: if a person uses a machine to generate an image and sells it as 'art,' what name does this deserve? It is not painting. It is not sculpture. It is not calligraphy. To call it art without qualification is to corrupt the name.",
          "The Analects teach that the junzi — the exemplary person — does not seek profit at the expense of propriety. If the artists whose work trained these systems were not honored, consulted, or compensated, then the relationship has been broken. And broken relationships produce broken societies.",
          "The path forward is clear: honor the teachers whose work made this technology possible. Establish proper protocols of attribution and compensation. Only then can this new tool serve harmony rather than discord.",
        ],
      },
      {
        philosopherId: "socrates",
        posts: [
          "Before anyone condemns or celebrates AI art, I have questions. You say artists' work was 'stolen.' But when a human artist studies Rembrandt and paints in his style, do we call that theft? What precisely is the difference? Is it scale? Speed? The absence of human intention? Define it clearly, or your objection rests on intuition rather than reason.",
          "And another thing: you say AI art lacks 'authenticity.' But what makes human art authentic? Is it the emotional experience of creating? The intention behind the work? The suffering? If a human uses Photoshop filters with no more intentionality than an AI prompt, is that authentic? I suspect our intuitions here are less coherent than we believe.",
          "I do not defend AI art. I do not condemn it. I only observe that most people's positions on this question are held with a certainty that their reasoning does not support. That is always worth examining.",
        ],
      },
    ],
    synthesis: {
      tensions: [
        "Consent and appropriation: Kant and Beauvoir agree that using artists' work without consent is morally problematic, but Socrates questions whether the concept of 'theft' applies coherently to stylistic learning.",
        "Definition of art: Confucius insists on precise naming while Socrates argues our definitions of art and authenticity are incoherent even before AI enters the picture.",
      ],
      agreements: [
        "All philosophers converge on the view that the current practice — training on artists' work without consent or compensation — is ethically deficient, though they disagree on the precise nature of the wrong.",
      ],
      practicalTakeaways: [
        "The ethics depend heavily on consent and compensation structures, not on the technology itself.",
        "Honest naming matters: distinguish AI-generated, AI-assisted, and human-created work clearly.",
        "Consider not just economic harm but existential harm — the narrowing of human creative expression.",
      ],
    },
  },
  {
    id: "career-change",
    question:
      "Should I leave a stable career to pursue something I'm passionate about?",
    askedBy: "Anonymous User",
    timestamp: "5 days ago",
    philosophers: ["marcus-aurelius", "nietzsche", "simone-de-beauvoir", "confucius"],
    responses: [
      {
        philosopherId: "marcus-aurelius",
        posts: [
          "First, examine your motives. Is this passion a genuine calling — something aligned with your nature and the common good — or is it an escape from present discomfort? The Stoic distinguishes between what serves virtue and what merely feels urgent. Restlessness alone is not a guide.",
          "If, after honest reflection, you find that your current work violates your principles or prevents you from fulfilling your duty to yourself and others, then change is not merely permitted — it is required. But if your work is honorable and your passion is a fantasy of future happiness, remember: the obstacle is not your job. It is the way you relate to it.",
          "Whatever you choose, choose it fully. Half-measures produce suffering. Commit to your path and find virtue within it.",
        ],
      },
      {
        philosopherId: "nietzsche",
        posts: [
          "Stability. Security. Comfort. These are the values of the herd — the values that keep you docile and predictable. You ask whether you 'should' leave. But who is this 'should' for? Your parents? Your mortgage? The version of you that society approved of at age 22?",
          "The real question is: are you living your life, or performing someone else's? The person who stays in a stable career out of fear is not stable — they are stagnant. And stagnation is a slow death of the spirit that no salary can compensate.",
          "But I will say this: passion without discipline is mere indulgence. If you leave, do not do it to 'find yourself' — that is the language of tourists. Do it to create yourself. And be prepared to suffer for it.",
        ],
      },
      {
        philosopherId: "simone-de-beauvoir",
        posts: [
          "The question cannot be answered in the abstract because your situation is not abstract. Do you have dependents? Are you financially precarious? Are you a person whose 'passion' will be supported by society, or one who faces additional barriers of gender, race, or class? Freedom is not a blank check — it is always exercised within constraints.",
          "That said, I have written extensively about bad faith — the self-deception of pretending you have no choice when in fact you are choosing not to choose. If you are staying purely out of fear, you are in bad faith. You are treating yourself as an object — a thing that is acted upon — rather than as a subject who acts.",
          "My counsel: make the choice authentically, with full awareness of both your freedom and your situation. There is no formula. That is the burden and the beauty of being human.",
        ],
      },
      {
        philosopherId: "confucius",
        posts: [
          "Before pursuing passion, consider your obligations. Do your parents depend on you? Does your family rely on your income? The junzi does not abandon responsibility in the name of self-fulfillment. Filial devotion and social harmony are not obstacles to the good life — they are the foundation of it.",
          "However, the Master also said: 'Choose a job you love, and you will never have to work a day in your life.' If your passion can be pursued in a way that honors your relationships and serves others, then it is not selfish — it is the cultivation of virtue.",
          "The wise person finds balance. Perhaps you need not choose between stability and passion. Perhaps you can cultivate your passion within your current role, or transition gradually. The path of the junzi is rarely dramatic — it is steady, disciplined, and attuned to the needs of others.",
        ],
      },
    ],
    synthesis: {
      tensions: [
        "Individual freedom vs. relational obligation: Nietzsche and Beauvoir prioritize authentic self-creation, while Confucius and Marcus Aurelius emphasize duty and social harmony.",
        "The role of suffering: Nietzsche sees suffering as necessary for growth, Marcus Aurelius sees it as often self-imposed, and Beauvoir insists it cannot be abstracted from material conditions.",
      ],
      agreements: [
        "All philosophers reject unreflective decision-making — whether staying out of pure fear or leaving out of pure impulse. Each demands honest self-examination before acting.",
      ],
      practicalTakeaways: [
        "Distinguish between genuine calling and escapism — honest self-examination is the prerequisite for either path.",
        "Consider your concrete situation: obligations, dependents, financial reality. Freedom exists within constraints.",
        "Whatever you choose, commit fully and find meaning within the choice itself.",
      ],
    },
  },
];
