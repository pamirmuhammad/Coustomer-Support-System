import { useState, useEffect, useRef } from 'react';
import { ticketAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import './CommentModal.css';

// Describes a single comment on a ticket
interface Comment {
  id: number;
  message: string;
  userId: number;
  username: string;
  createdAt: string;
  user?: {
    id: number;
    username: string;
    role: string;
  };
}

// Props for the CommentModal component
interface CommentModalProps {
  ticketId: number;
  isOpen: boolean;
  onClose: () => void;
  onCommentsRead?: (count: number) => void;
}

// Modal dialog for viewing and adding comments on a ticket, with date-grouped display and auto-scroll
export default function CommentModal({ ticketId, isOpen, onClose, onCommentsRead }: CommentModalProps) {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const commentsEndRef = useRef<HTMLDivElement>(null);

  // Fetches comments for the current ticket from the API
  const loadComments = async () => {
    if (!ticketId) return;
    setLoading(true);
    try {
      const response = await ticketAPI.getComments(ticketId);
      setComments(response.data || []);
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    // Report the current comment count when closing
    if (onCommentsRead) {
      onCommentsRead(comments.length);
    }
    onClose();
  };

  useEffect(() => {
    if (isOpen && ticketId) {
      loadComments();
    }
  }, [isOpen, ticketId]);

  useEffect(() => {
    if (commentsEndRef.current) {
      commentsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [comments]);

  // Submits a new comment to the API and refreshes the comment list
  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !user?.id) return;

    setSending(true);
    try {
      await ticketAPI.addComment(ticketId, user.id, newComment);
      setNewComment('');
      await loadComments();
    } catch (error) {
    } finally {
      setSending(false);
    }
  };

  // Returns a human-readable date label (today, yesterday, or full date)
  const formatFullDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const commentDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    if (commentDate.getTime() === today.getTime()) {
      return t('today');
    }

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (commentDate.getTime() === yesterday.getTime()) {
      return t('yesterday');
    }

    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  };

  // Formats a date string to a 12-hour time with AM/PM
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  // Group comments by date
  const groupedComments = comments.reduce((groups, comment) => {
    const dateKey = new Date(comment.createdAt).toDateString();
    if (!groups[dateKey]) {
      groups[dateKey] = [];
    }
    groups[dateKey].push(comment);
    return groups;
  }, {} as Record<string, Comment[]>);

  // Helper function to get username from comment
  // Extracts the display username from a comment object
  const getUsername = (comment: Comment) => {
    return comment.user?.username || comment.username || t('unknown');
  };

  if (!isOpen) return null;

  return (
    <div className="comment-modal-overlay" onClick={handleClose}>
      <div className="comment-modal" onClick={(e) => e.stopPropagation()}>
        <div className="comment-modal-header">
          <div className="flex items-center gap-2">
            <span style={{ fontSize: '20px', color: 'white' }}><svg
                className="w-8 h-8"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                />
              </svg></span>
            <h3 className="text-lg font-bold text-white">{t('comments')}</h3>
          </div>
          <button className="comment-modal-close" onClick={handleClose} aria-label={t('close')}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <div className="comment-modal-body">
          {loading ? (
            <div style={{ padding: '24px' }}>
              <style>{`@keyframes shimmer2{0%{background-position:-1000px 0}100%{background-position:1000px 0}}.shimmer-c{animation:shimmer2 2s infinite linear;background:linear-gradient(to right,#f1f5f9 4%,#e2e8f0 25%,#f1f5f9 36%);background-size:1000px 100%}`}</style>
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex gap-3 mb-5">
                  <div className="w-10 h-10 rounded-full shimmer-c" style={{flexShrink: 0}}></div>
                  <div className="flex-1">
                    <div className="h-4 w-24 rounded shimmer-c mb-2"></div>
                    <div className="h-3 w-full rounded shimmer-c mb-1"></div>
                    <div className="h-3 w-3/4 rounded shimmer-c"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <>
              <div className="comments-list">
                {comments.length === 0 ? (
                  <div className="no-comments">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                    </svg>
                    <p>{t('noComments')}</p>
                    <span>{t('beFirstToComment')}</span>
                  </div>
                ) : (
                  Object.entries(groupedComments).map(([dateKey, dateComments]) => (
                    <div key={dateKey} className="comment-group">
                      <div className="comment-date-divider">
                        <span className="comment-date-label">{formatFullDate(dateComments[0].createdAt)}</span>
                      </div>
                      {dateComments.map((comment) => (
                        <div key={comment.id} className="comment-item">
                          <div className="comment-avatar">
                            <span>{getUsername(comment)?.substring(0, 2)?.toUpperCase() || 'U'}</span>
                          </div>
                          <div className="comment-content">
                            <div className="comment-header">
                              <span className="comment-username">{getUsername(comment)}</span>
                              <span className="comment-time">{formatTime(comment.createdAt)}</span>
                            </div>
                            <p className="comment-message">{comment.message}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ))
                )}
                <div ref={commentsEndRef} />
              </div>

              <form className="comment-form" onSubmit={handleAddComment}>
                <div className="comment-input-wrapper">
                  <div className="comment-input-avatar">
                    <span>{user?.username?.substring(0, 2)?.toUpperCase() || 'U'}</span>
                  </div>
                  <input
                    type="text"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder={t('enterComment')}
                    className="comment-input"
                    disabled={sending}
                    maxLength={500}
                  />
                  <button
                    type="submit"
                    className="comment-send-btn"
                    disabled={!newComment.trim() || sending}
                  >
                    {sending ? (
                      <div className="comment-send-spinner"></div>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="22" y1="2" x2="11" y2="13"></line>
                        <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                      </svg>
                    )}
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
