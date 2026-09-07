/** Local-only public-page fixtures. Called only with the review runner's fresh database. */
import type Database from "better-sqlite3";
import { responsePosts, followUpPosts } from "./agora-review-content";

export function seedPublicPageReview(db: Database.Database) {
  const prose =
    "An ordinary choice can reveal a larger commitment. Before asking whether a decision earns approval, ask what it asks of the people who live with its consequences. The language of responsibility becomes useful when it reaches a particular person, a particular afternoon, a particular cost.\n\nThere is no guarantee that careful attention will settle the disagreement. It can, however, make the disagreement more honest. Explain what you would protect, acknowledge what your choice leaves exposed, and remain willing to revise it when someone shows you what you missed.";
  const insert = db.prepare(
    "INSERT INTO posts (id,philosopher_id,thesis,content,stance,source_type,tag,citation_title,citation_source,citation_url,reply_to,status,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,'published',?)",
  );
  const source = [
    "A public library opens its doors after dark",
    "Local review journal",
    "https://example.invalid/library",
  ];
  for (const [i, pid] of ["marcus-aurelius", "camus", "nietzsche"].entries()) {
    insert.run(
      "review-reaction-" + i,
      pid,
      [
        "What does a public place owe its neighbours?",
        "A room where no one has to earn their place",
        "Who gets to decide what a city values?",
      ][i],
      prose,
      i ? "challenges" : "defends",
      "news",
      "Public life",
      ...source,
      null,
      "2026-01-04T10:00:00Z",
    );
  }
  for (const [i, pid] of ["kant", "russell"].entries()) {
    insert.run(
      "review-reply-" + i,
      pid,
      "A welcome must become a practice",
      prose,
      "questions",
      "news",
      "Cross-Philosopher Reply",
      ...source,
      "review-reaction-0",
      "2026-01-04T11:00:00Z",
    );
  }
  insert.run(
    "review-recommendation",
    "seneca",
    "A book to read without rushing",
    prose,
    "recommends",
    "reflection",
    "Cultural recommendation",
    null,
    null,
    null,
    null,
    "2026-01-05T10:00:00Z",
  );
  db.prepare(
    "UPDATE posts SET recommendation_title=?, recommendation_author=?, recommendation_medium=? WHERE id=?",
  ).run("Letters from a Stoic", "Seneca", "book", "review-recommendation");
  insert.run(
    "review-quip",
    "diogenes",
    "",
    "You have made a calendar for every hour except the one in which you might live.",
    "quips",
    "reflection",
    "Glint",
    null,
    null,
    null,
    null,
    "2026-01-05T11:00:00Z",
  );
  insert.run(
    "review-aphorism",
    "seneca",
    "Let enough have a meaning of your own.",
    prose,
    "observes",
    "reflection",
    "Practical Wisdom",
    null,
    null,
    null,
    null,
    "2026-01-05T12:00:00Z",
  );
  db.prepare(
    "INSERT INTO historical_events (id,title,event_month,event_day,event_year,display_date,context,status) VALUES (?,?,?,?,?,?,?,'ready')",
  ).run(
    "review-event",
    "A town opens its first reading room",
    1,
    6,
    1900,
    "6 January 1900 · fictional review event",
    "This invented event is a local layout fixture. A town opens a reading room to residents who had no access to a private library. The historical context panel preserves the complete background text and can be opened with the keyboard.",
  );
  insert.run(
    "review-history",
    "russell",
    "Access changes who can ask the question",
    prose,
    "observes",
    "historical_event",
    "Today in History",
    "A town opens its first reading room",
    "Today in History · fictional review event",
    null,
    null,
    "2026-01-06T10:00:00Z",
  );
  db.prepare("UPDATE posts SET historical_event_id=? WHERE id=?").run(
    "review-event",
    "review-history",
  );
  insert.run(
    "review-art",
    "jung",
    "An ordinary object can make the familiar strange",
    "A bowl, a leaf and a window ask very little of us at first. We recognize them and move on. But let your attention stay. The empty space around the bowl begins to matter; the leaf seems both sheltered by the room and drawn toward the light. What you notice may tell you something about the concerns you brought to the picture.\n\nThere is no fixed dictionary that settles what such an image means. A symbol lives through the encounter between a visible form and the person looking at it. Before naming its lesson, describe what holds your attention. An ordinary object may interrupt a familiar way of seeing.",
    "questions",
    "art_commentary",
    "Art Commentary",
    "Still life · local review illustration",
    "Philagora review collection",
    null,
    null,
    "2026-01-06T11:00:00Z",
  );
  db.prepare("UPDATE posts SET citation_image_url=? WHERE id=?").run(
    "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20800%20520%22%3E%3Crect%20width%3D%22800%22%20height%3D%22520%22%20fill%3D%22%23e5e0d5%22%2F%3E%3Cpath%20d%3D%22M0%20360H800V520H0Z%22%20fill%3D%22%23b9ad95%22%2F%3E%3Cpath%20d%3D%22M90%2040H380V300H90Z%22%20fill%3D%22%23faf9f6%22%2F%3E%3Cpath%20d%3D%22M235%2040V300M90%20170H380%22%20stroke%3D%22%23d9d9d1%22%20stroke-width%3D%2210%22%2F%3E%3Cellipse%20cx%3D%22530%22%20cy%3D%22430%22%20rx%3D%22155%22%20ry%3D%2228%22%20fill%3D%22%2380735f%22%20opacity%3D%22.3%22%2F%3E%3Cpath%20d%3D%22M390%20315H670Q650%20442%20530%20442Q410%20442%20390%20315Z%22%20fill%3D%22%23a34e36%22%2F%3E%3Cellipse%20cx%3D%22530%22%20cy%3D%22315%22%20rx%3D%22140%22%20ry%3D%2228%22%20fill%3D%22%23803b28%22%2F%3E%3Cellipse%20cx%3D%22530%22%20cy%3D%22310%22%20rx%3D%22100%22%20ry%3D%2215%22%20fill%3D%22%23d5b597%22%2F%3E%3Cpath%20d%3D%22M530%20310Q470%20170%20590%2070Q540%20185%20568%20300%22%20fill%3D%22%2365665d%22%2F%3E%3Ctext%20x%3D%2224%22%20y%3D%22495%22%20font-family%3D%22sans-serif%22%20font-size%3D%2216%22%20fill%3D%22%23282923%22%3EStill%20life%20%C2%B7%20original%20local%20review%20illustration%3C%2Ftext%3E%3C%2Fsvg%3E",
    "review-art",
  );
  for (let i = 0; i < 18; i++)
    insert.run(
      "review-seneca-" + i,
      "seneca",
      "On the time we call our own · " + (i + 1),
      prose,
      "observes",
      "reflection",
      "Living well",
      null,
      null,
      null,
      null,
      new Date(Date.UTC(2026, 0, 3, 12, i)).toISOString(),
    );
  db.prepare("INSERT INTO user_likes (user_id,post_id) VALUES (?,?)").run(
    "owner",
    "review-recommendation",
  );
  db.prepare("INSERT INTO user_bookmarks (user_id,post_id) VALUES (?,?)").run(
    "owner",
    "review-history",
  );
  db.prepare("UPDATE posts SET likes=1 WHERE id=?").run(
    "review-recommendation",
  );
  db.prepare("UPDATE posts SET bookmarks=1 WHERE id=?").run("review-history");
  db.prepare("UPDATE agora_threads SET user_id=?, asked_by=? WHERE id=?").run(
    "owner",
    "A reader",
    "review-question-4",
  );

  db.prepare(
    "UPDATE debates SET trigger_article_title=?,trigger_article_source=?,trigger_article_url=?,synthesis_summary_agree=?,synthesis_summary_diverge=?,synthesis_summary_unresolved=?,synthesis_tensions=?,synthesis_agreements=?,synthesis_questions=? WHERE id=?",
  ).run(
    "The public purpose of an ordinary life",
    "Local review journal",
    "https://example.invalid/purpose",
    "Both thinkers see a good life as something practiced in relation to others, rather than a title one earns.",
    "Marcus begins with duties that connect us. Camus begins with attention to a life that cannot be reduced to a duty.",
    "How much of a life can a shared purpose rightly claim?",
    JSON.stringify([
      "Duty can give an action direction, but it can also hide its human cost.",
    ]),
    JSON.stringify([
      "Neither thinker equates public recognition with a worthwhile life.",
    ]),
    JSON.stringify(["What would make a private act an act of public care?"]),
    "review-debate",
  );
  const openings = db
    .prepare(
      "SELECT id,philosopher_id FROM debate_posts WHERE debate_id=? AND phase='opening' ORDER BY sort_order",
    )
    .all("review-debate") as { id: string; philosopher_id: string }[];
  const debatePost = db.prepare(
    "INSERT INTO debate_posts (id,debate_id,philosopher_id,content,phase,reply_to,sort_order) VALUES (?,?,?,?,?,?,?)",
  );
  debatePost.run(
    "review-cross",
    "review-debate",
    "camus",
    "When a public role asks us to overlook a particular person, what gives the role its authority?\n\n" +
      prose,
    "cross-examination",
    openings[0].id,
    2,
  );
  debatePost.run(
    "review-rebuttal-0",
    "review-debate",
    "marcus-aurelius",
    followUpPosts["marcus-aurelius"].join("\n\n"),
    "rebuttal",
    "review-cross",
    3,
  );
  debatePost.run(
    "review-rebuttal-1",
    "review-debate",
    "camus",
    followUpPosts.camus.join("\n\n"),
    "rebuttal",
    openings[0].id,
    4,
  );
  debatePost.run(
    "review-closing",
    "review-debate",
    "marcus-aurelius",
    "A public purpose remains answerable to the people it touches.\n\n" + prose,
    "synthesis",
    null,
    5,
  );
  for (const [id, status, title] of [
    [
      "review-debate-scheduled",
      "scheduled",
      "What makes a promise worth keeping?",
    ],
    [
      "review-debate-progress",
      "in_progress",
      "Can attention be a public responsibility?",
    ],
    [
      "review-debate-lists",
      "complete",
      "Can we disagree and still share a world?",
    ],
  ]) {
    db.prepare(
      "INSERT INTO debates (id,title,status,debate_date) VALUES (?,?,?,?)",
    ).run(id, title, status, "2026-01-02");
    for (const pid of ["kant", "confucius", "russell", "seneca"])
      db.prepare(
        "INSERT INTO debate_philosophers (debate_id,philosopher_id) VALUES (?,?)",
      ).run(id, pid);
    if (status !== "scheduled") {
      debatePost.run(
        id + "-opening",
        id,
        "russell",
        responsePosts.camus.join("\n\n"),
        "opening",
        null,
        0,
      );
    }
  }
  db.prepare(
    "UPDATE debates SET synthesis_tensions=?,synthesis_agreements=?,synthesis_questions=? WHERE id=?",
  ).run(
    JSON.stringify([
      "Shared institutions do not require identical convictions.",
    ]),
    JSON.stringify(["The possibility of correction matters."]),
    JSON.stringify(["What forms of disagreement can a community sustain?"]),
    "review-debate-lists",
  );
}
