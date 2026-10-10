import React, { useState, useEffect } from 'react';

// NOTE: This remains a frontend placeholder using localStorage. 
// No real threading or POST requests backends exist yet.
// TODO: Hook up to actual database/backend for production.

interface Reply {
  id: string;
  text: string;
  date: string;
}

interface Review {
  id: string;
  text: string;
  date: string;
  likes: number;
  dislikes: number;
  liked: boolean;
  disliked: boolean;
  replies: Reply[];
}

export const FeedbackForm: React.FC = () => {
  const [feedback, setFeedback] = useState<string>('');
  const [reviews, setReviews] = useState<Review[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');

  useEffect(() => {
    const saved = localStorage.getItem('graffiti_feedback_v2');
    if (saved) {
      try {
        setReviews(JSON.parse(saved));
      } catch (e) {}
    } else {
      setReviews([{
        id: 'mock-1',
        text: 'The web wallpaper mode is incredibly smooth. I tested it with a complex GLB model and the resource usage was surprisingly low!',
        date: 'Aug 29, 2026',
        likes: 12,
        dislikes: 0,
        liked: false,
        disliked: false,
        replies: []
      }]);
    }
  }, []);

  const saveToLocal = (newReviews: Review[]) => {
    setReviews(newReviews);
    localStorage.setItem('graffiti_feedback_v2', JSON.stringify(newReviews));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedback.trim()) return;

    setIsSubmitting(true);
    setTimeout(() => {
      const newReview: Review = {
        id: crypto.randomUUID(),
        text: feedback,
        date: new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }),
        likes: 0,
        dislikes: 0,
        liked: false,
        disliked: false,
        replies: []
      };

      saveToLocal([newReview, ...reviews]);
      setFeedback('');
      setIsSubmitting(false);
    }, 400);
  };

  const handleAction = (id: string, action: 'like' | 'dislike') => {
    const newReviews = reviews.map(r => {
      if (r.id === id) {
        if (action === 'like') {
          const wasLiked = r.liked;
          return { ...r, liked: !wasLiked, disliked: false, likes: r.likes + (wasLiked ? -1 : 1), dislikes: r.disliked ? r.dislikes - 1 : r.dislikes };
        } else {
          const wasDisliked = r.disliked;
          return { ...r, disliked: !wasDisliked, liked: false, dislikes: r.dislikes + (wasDisliked ? -1 : 1), likes: r.liked ? r.likes - 1 : r.likes };
        }
      }
      return r;
    });
    saveToLocal(newReviews);
  };

  const handleReplySubmit = (id: string) => {
    if (!replyText.trim()) return;
    const newReviews = reviews.map(r => {
      if (r.id === id) {
        return {
          ...r,
          replies: [...r.replies, {
            id: crypto.randomUUID(),
            text: replyText,
            date: new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
          }]
        };
      }
      return r;
    });
    saveToLocal(newReviews);
    setReplyingTo(null);
    setReplyText('');
  };

  return (
    <div className="w-full max-w-2xl mx-auto space-y-16">
      
      {/* Input Form */}
      <div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <label htmlFor="feedback" className="block font-sans text-xs uppercase tracking-[0.15em] text-[var(--color-secondary)] mb-4">
            Share your experience or ask a question
          </label>
          <div className="bg-[var(--color-surface)] border-b border-[var(--color-border)] p-4">
             <textarea 
               id="feedback"
               rows={3}
               value={feedback}
               onChange={(e) => setFeedback(e.target.value)}
               className="w-full bg-transparent text-[var(--color-primary)] font-sans focus:outline-none resize-none placeholder:text-[#554D40]"
               placeholder="Let us know what you think..."
             />
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={!feedback.trim() || isSubmitting}
              className={`px-8 py-3 font-sans text-sm uppercase tracking-widest transition-all duration-300 ${
                feedback.trim() 
                  ? 'bg-transparent border border-[var(--color-accent)] text-[var(--color-primary)] hover:bg-[var(--color-accent)] hover:text-[#0B0A08]' 
                  : 'border border-[var(--color-border)] text-[#443E33] cursor-not-allowed'
              } ${isSubmitting ? 'opacity-50' : ''}`}
            >
              {isSubmitting ? 'Posting...' : 'Post'}
            </button>
          </div>
        </form>
      </div>

      {/* Reviews List */}
      {reviews.length > 0 && (
        <div className="space-y-0">
          <div className="h-px w-full bg-[var(--color-border)] mb-8" />
          {reviews.map((review) => (
            <div key={review.id} className="py-8 border-b border-[var(--color-border)] last:border-0">
              
              <div className="flex justify-between items-start mb-4">
                <span className="font-mono text-xs uppercase tracking-widest text-[var(--color-secondary)]/50">
                  {review.date}
                </span>
              </div>
              
              <p className="font-sans text-lg text-[var(--color-primary)] leading-relaxed mb-6">
                {review.text}
              </p>

              {/* Actions */}
              <div className="flex items-center gap-6 font-sans text-sm text-[var(--color-secondary)] uppercase tracking-wider">
                <button onClick={() => handleAction(review.id, 'like')} className={`hover:text-[var(--color-accent)] transition-colors flex items-center gap-2 ${review.liked ? 'text-[var(--color-accent)]' : ''}`}>
                  <span>Like</span>
                  {review.likes > 0 && <span className="text-xs">{review.likes}</span>}
                </button>
                <button onClick={() => handleAction(review.id, 'dislike')} className={`hover:text-[var(--color-accent)] transition-colors flex items-center gap-2 ${review.disliked ? 'text-[var(--color-accent)]' : ''}`}>
                  <span>Dislike</span>
                  {review.dislikes > 0 && <span className="text-xs">{review.dislikes}</span>}
                </button>
                <button 
                  onClick={() => { setReplyingTo(replyingTo === review.id ? null : review.id); setReplyText(''); }} 
                  className="hover:text-[var(--color-primary)] transition-colors"
                >
                  Reply
                </button>
              </div>

              {/* Inline Reply Form */}
              {replyingTo === review.id && (
                <div className="mt-6 bg-[var(--color-surface)] border-l-2 border-[var(--color-accent)] p-4 flex flex-col gap-4 animate-[fadeIn_0.2s_ease-out]">
                  <textarea 
                    rows={2}
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    className="w-full bg-transparent text-[var(--color-primary)] font-sans focus:outline-none resize-none placeholder:text-[#554D40]"
                    placeholder="Write a reply..."
                    autoFocus
                  />
                  <div className="flex justify-end gap-4">
                     <button onClick={() => setReplyingTo(null)} className="text-[var(--color-secondary)] hover:text-white uppercase tracking-widest text-xs">Cancel</button>
                     <button onClick={() => handleReplySubmit(review.id)} className="text-[var(--color-accent)] hover:text-[#F4E2B8] uppercase tracking-widest text-xs">Submit</button>
                  </div>
                </div>
              )}

              {/* Nested Replies */}
              {review.replies.length > 0 && (
                <div className="mt-6 space-y-4 pl-6 border-l border-[var(--color-border)]">
                  {review.replies.map(reply => (
                    <div key={reply.id} className="pt-2">
                       <span className="font-mono text-xs uppercase tracking-widest text-[var(--color-secondary)]/50 block mb-2">
                         {reply.date}
                       </span>
                       <p className="font-sans text-[var(--color-secondary)] leading-relaxed">
                         {reply.text}
                       </p>
                    </div>
                  ))}
                </div>
              )}

            </div>
          ))}
        </div>
      )}

    </div>
  );
};
