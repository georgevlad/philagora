"use client";
import { useState } from "react";

export function IssueQuestionPreview() {
  const [question, setQuestion] = useState("");
  const [context, setContext] = useState(true);
  const [visibility, setVisibility] = useState("private");
  const [preview, setPreview] = useState(false);
  return (
    <section id="ask-preview" className="agora-preview-composer">
      <p className="agora-eyebrow">Contextual question · Sample workflow</p>
      <h2>What would you ask about this?</h2>
      <p>
        This feature is a preview. Nothing entered here is sent, saved or
        published.
      </p>
      {context && (
        <div className="agora-resume">
          <span>
            Sample context: When a city overheats, who gets protected first?
          </span>
          <button
            type="button"
            className="agora-text-link"
            onClick={() => setContext(false)}
          >
            Remove context
          </button>
        </div>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setPreview(true);
        }}
      >
        <label className="agora-field-label" htmlFor="preview-question">
          Your sample question
        </label>
        <textarea
          id="preview-question"
          rows={3}
          maxLength={500}
          value={question}
          onChange={(e) => {
            setQuestion(e.target.value);
            setPreview(false);
          }}
          placeholder="What would you ask about this issue?"
        />
        <fieldset className="agora-visibility">
          <legend className="sr-only">Sample question visibility</legend>
          {["private", "public"].map((v) => (
            <label key={v}>
              <input
                type="radio"
                name="preview-visibility"
                checked={v === visibility}
                onChange={() => setVisibility(v)}
              />
              {v === "private" ? "Private" : "Public"}
            </label>
          ))}
        </fieldset>
        <button className="agora-button" disabled={question.trim().length < 10}>
          Preview contextual question →
        </button>
      </form>
      {preview && (
        <div className="agora-notice" role="status">
          <strong>Sample only · Nothing submitted</strong>
          <p>{question}</p>
          <p>
            Preview audience: {visibility}.{" "}
            {context
              ? "The sample issue and its sources would be attached."
              : "No issue context attached."}
          </p>
        </div>
      )}
    </section>
  );
}
