import { useEffect, useState } from 'react';

export default function FeedbackForm() {
  const [message, setMessage] = useState('');
  const [kind, setKind] = useState('Thought');
  const [saved, setSaved] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackItems, setFeedbackItems] = useState<Array<{ kind: string; message: string; at: string }>>([]);

  useEffect(() => {
    const savedFeedback = localStorage.getItem('graffiti_feedback_items');
    if (!savedFeedback) return;
    try { setFeedbackItems(JSON.parse(savedFeedback)); } catch { setFeedbackItems([]); }
  }, []);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!message.trim()) return;
    const next = [{ kind, message: message.trim(), at: new Date().toISOString() }, ...feedbackItems];
    localStorage.setItem('graffiti_feedback_items', JSON.stringify(next));
    localStorage.setItem('graffiti_feedback_draft', JSON.stringify(next[0]));
    setFeedbackItems(next);
    setMessage('');
    setSaved(true);
  };

  return (
    <form className="feedback-form" onSubmit={submit}>
      <fieldset className="feedback-types">
        <legend>Note type</legend>
        <div className="feedback-type-options" role="radiogroup" aria-label="Note type">
          {['Thought', 'Bug', 'Question', 'Effect idea'].map((option) => (
            <button key={option} type="button" role="radio" aria-checked={kind === option} className={kind === option ? 'is-selected' : ''} onClick={() => { setKind(option); setSaved(false); }}>{option}</button>
          ))}
        </div>
      </fieldset>
      <label>
        Your note
        <textarea value={message} onChange={(event) => { setMessage(event.target.value); setSaved(false); }} placeholder="Write it as you see it…" rows={5} required />
      </label>
      <div className="form-foot">
        <button className="button button-primary" type="submit" disabled={!message.trim()}>{saved ? 'Saved locally' : 'Save feedback'} <b aria-hidden="true">↗</b></button>
        <button className="button button-ghost feedback-view-button" type="button" onClick={() => setShowFeedback((value) => !value)}>{showFeedback ? 'Hide feedback' : `View feedback (${feedbackItems.length})`}</button>
        <span aria-live="polite">{saved ? 'Saved in this browser. No network submission was made.' : 'Saved only in this browser. Nothing is sent online.'}</span>
      </div>
      {showFeedback && <div className="feedback-list" aria-live="polite">
        {feedbackItems.length === 0 ? <p className="feedback-empty">No saved notes yet. Your feedback will appear here after you save it.</p> : feedbackItems.map((item, index) => <article key={`${item.at}-${index}`}><span>{item.kind}</span><p>{item.message}</p><time dateTime={item.at}>{new Date(item.at).toLocaleDateString()}</time></article>)}
      </div>}
    </form>
  );
}
