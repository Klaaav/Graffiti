import { useState } from 'react';

export default function FeedbackForm() {
  const [message, setMessage] = useState('');
  const [kind, setKind] = useState('Thought');
  const [saved, setSaved] = useState(false);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!message.trim()) return;
    localStorage.setItem('graffiti_feedback_draft', JSON.stringify({ kind, message, at: new Date().toISOString() }));
    setMessage('');
    setSaved(true);
  };

  return (
    <form className="feedback-form" onSubmit={submit}>
      <label>
        Note type
        <select value={kind} onChange={(event) => setKind(event.target.value)}>
          <option>Thought</option>
          <option>Bug</option>
          <option>Question</option>
          <option>Effect idea</option>
        </select>
      </label>
      <label>
        Your note
        <textarea value={message} onChange={(event) => { setMessage(event.target.value); setSaved(false); }} placeholder="Write it as you see it…" rows={5} required />
      </label>
      <div className="form-foot">
        <button className="button button-primary" type="submit" disabled={!message.trim()}>{saved ? 'Saved locally' : 'Save feedback'} <b aria-hidden="true">↗</b></button>
        <span aria-live="polite">{saved ? 'Saved in this browser. No network submission was made.' : 'Local-only until a real submission destination is provided.'}</span>
      </div>
    </form>
  );
}
