import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { api, chatWithAI, getNotes, createNote, updateNote, deleteNote as apiDeleteNote, bulkUploadNotes } from '../lib/api';
import ReadingHelper from './ReadingHelper';

const BookIcon = ({ size = 20 }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
</svg>);

const UploadIcon = ({ size = 20 }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
  <polyline points="17 8 12 3 7 8"/>
  <line x1="12" y1="3" x2="12" y2="15"/>
</svg>);

const PlusIcon = ({ size = 20 }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
  <line x1="12" y1="5" x2="12" y2="19"/>
  <line x1="5" y1="12" x2="19" y2="12"/>
</svg>);

const ArrowLeftIcon = ({ size = 20 }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
  <line x1="19" y1="12" x2="5" y2="12"/>
  <polyline points="12 19 5 12 12 5"/>
</svg>);

const TrashIcon = ({ size = 20 }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
  <polyline points="3 6 5 6 21 6"/>
  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
  <line x1="10" y1="11" x2="10" y2="17"/>
  <line x1="14" y1="11" x2="14" y2="17"/>
</svg>);

const EditIcon = ({ size = 20 }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
</svg>);

const MessageIcon = ({ size = 20 }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
</svg>);

const FloatIcon = ({ size = 20 }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
  <rect x="3" y="3" width="18" height="18" rx="2"/>
  <path d="M9 9h6v6H9z"/>
</svg>);

function ReadingNotesPage({ onClose, onSendMessage, onToggleFloat, floatVisible, onFloatVisibilityChange }) {
  const [notes, setNotes] = useState([]);
  const [selectedNote, setSelectedNote] = useState(null);
  const [selectedBook, setSelectedBook] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTag, setActiveTag] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showNewNoteModal, setShowNewNoteModal] = useState(false);
  const [newNoteText, setNewNoteText] = useState('');
  const [newNoteBook, setNewNoteBook] = useState('');
  const [newNoteTags, setNewNoteTags] = useState([]);
  const [allTags, setAllTags] = useState([]);
  const [showTagModal, setShowTagModal] = useState(false);
  const [newTagInput, setNewTagInput] = useState('');
  const [discussInput, setDiscussInput] = useState('');
  const [discussLoading, setDiscussLoading] = useState(false);
  const [discussions, setDiscussions] = useState({});

  useEffect(() => {
    loadNotes();
  }, []);

  const loadNotes = async () => {
    try {
      setIsLoading(true);
      const response = await getNotes();
      if (response.success && response.data) {
        setNotes(response.data);
        extractAllTags(response.data);
      } else {
        const localNotes = JSON.parse(localStorage.getItem('readingNotes') || '[]');
        if (localNotes.length > 0) {
          setNotes(localNotes);
          extractAllTags(localNotes);
        }
      }
    } catch (error) {
      console.error('加载笔记失败:', error);
      const localNotes = JSON.parse(localStorage.getItem('readingNotes') || '[]');
      setNotes(localNotes);
      extractAllTags(localNotes);
    } finally {
      setIsLoading(false);
    }
  };

  const extractAllTags = (notesData) => {
    const tags = new Set();
    notesData.forEach(note => {
      if (note.tags) {
        note.tags.forEach(tag => tags.add(tag));
      }
    });
    setAllTags([...tags]);
  };

  const handleSearch = (query) => {
    setSearchQuery(query);
  };

  const filteredNotes = notes.filter(note => {
    const matchesSearch = searchQuery === '' ||
      note.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      note.book.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTag = activeTag === null || (note.tags && note.tags.includes(activeTag));
    const matchesBook = selectedBook === null || note.book === selectedBook;
    return matchesSearch && matchesTag && matchesBook;
  });

  const groupedNotes = filteredNotes.reduce((acc, note) => {
    const book = note.book || '未分类';
    if (!acc[book]) acc[book] = [];
    acc[book].push(note);
    return acc;
  }, {});

  const handleBookSelect = (book) => {
    setSelectedBook(book === selectedBook ? null : book);
  };

  const handleTagSelect = (tag) => {
    setActiveTag(tag === activeTag ? null : tag);
  };

  const handleNoteSelect = (note) => {
    setSelectedNote(note);
    if (!discussions[note.id]) {
      setDiscussions({ ...discussions, [note.id]: [] });
    }
  };

  const handleBack = () => {
    setSelectedNote(null);
    setSelectedBook(null);
  };

  const createNewNote = async () => {
    if (!newNoteText.trim() || !newNoteBook.trim()) return;
    const note = {
      book: newNoteBook,
      content: newNoteText,
      tags: [...newNoteTags],
      createdAt: new Date().toISOString()
    };
    try {
      const response = await createNote(note);
      if (response.success && response.data) {
        setNotes([response.data, ...notes]);
        extractAllTags([response.data, ...notes]);
      } else {
        note.id = Date.now().toString();
        setNotes([note, ...notes]);
        extractAllTags([note, ...notes]);
        localStorage.setItem('readingNotes', JSON.stringify([note, ...notes]));
      }
      setShowNewNoteModal(false);
      setNewNoteText('');
      setNewNoteBook('');
      setNewNoteTags([]);
    } catch (error) {
      console.error('创建笔记失败:', error);
    }
  };

  const deleteNote = async (noteId) => {
    if (!confirm('确定要删除这条笔记吗？')) return;
    try {
      await apiDeleteNote(noteId);
      const updatedNotes = notes.filter(n => n.id !== noteId);
      setNotes(updatedNotes);
      extractAllTags(updatedNotes);
      localStorage.setItem('readingNotes', JSON.stringify(updatedNotes));
      if (selectedNote && selectedNote.id === noteId) {
        setSelectedNote(null);
      }
    } catch (error) {
      console.error('删除笔记失败:', error);
    }
  };

  const handleAddTag = (tag) => {
    if (!newNoteTags.includes(tag)) {
      setNewNoteTags([...newNoteTags, tag]);
    }
  };

  const removeTagFromNew = (tag) => {
    setNewNoteTags(newNoteTags.filter(t => t !== tag));
  };

  const addTagToNote = async () => {
    if (!newTagInput.trim() || !selectedNote) return;
    const updatedNote = {
      ...selectedNote,
      tags: [...(selectedNote.tags || []), newTagInput.trim()]
    };
    try {
      await updateNote(selectedNote.id, updatedNote);
      setNotes(notes.map(n => n.id === selectedNote.id ? updatedNote : n));
      extractAllTags(notes.map(n => n.id === selectedNote.id ? updatedNote : n));
      setSelectedNote(updatedNote);
      setNewTagInput('');
      setShowTagModal(false);
    } catch (error) {
      console.error('添加标签失败:', error);
    }
  };

  const deleteTag = async () => {
    if (!activeTag || !selectedNote) return;
    const updatedNote = {
      ...selectedNote,
      tags: (selectedNote.tags || []).filter(t => t !== activeTag)
    };
    try {
      await updateNote(selectedNote.id, updatedNote);
      setNotes(notes.map(n => n.id === selectedNote.id ? updatedNote : n));
      extractAllTags(notes.map(n => n.id === selectedNote.id ? updatedNote : n));
      setSelectedNote(updatedNote);
      setActiveTag(null);
    } catch (error) {
      console.error('删除标签失败:', error);
    }
  };

  const sendDiscussion = async (noteId) => {
    if (!discussInput.trim()) return;
    const note = notes.find(n => n.id === noteId);
    if (!note) return;
    setDiscussLoading(true);
    try {
      const response = await chatWithAI({
        message: `基于以下读书笔记进行讨论：\n\n书籍：${note.book}\n笔记内容：${note.content}\n\n用户讨论：${discussInput}`,
        chatId: null,
        tags: note.tags || []
      });
      if (response.success && response.data) {
        const newDiscussions = [...(discussions[noteId] || []), {
          user: discussInput,
          ai: response.data.content,
          timestamp: new Date().toISOString()
        }];
        setDiscussions({ ...discussions, [noteId]: newDiscussions });
      }
      setDiscussInput('');
    } catch (error) {
      console.error('讨论失败:', error);
    } finally {
      setDiscussLoading(false);
    }
  };

  if (selectedNote) {
    const note = notes.find(n => n.id === selectedNote.id);
    if (!note) return null;
    return createPortal(
      <div className="reading-notes-overlay">
        <style>{`
          .reading-notes-overlay {
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background: linear-gradient(135deg, #FAF7F2 0%, #F5F0E8 100%);
            z-index: 999999; display: flex; flex-direction: column;
            font-family: 'Noto Serif SC', serif;
          }
          .sub-page-header {
            display: flex; align-items: center; padding: 20px 32px;
            border-bottom: 1px solid rgba(138, 133, 128, 0.1); flex-shrink: 0;
          }
          @media (max-width: 640px) {
            .sub-page-header { padding: 12px 16px; }
          }
          .back-btn {
            width: 44px; height: 44px; border: none;
            background: rgba(138, 133, 128, 0.15); font-size: 20px;
            cursor: pointer; border-radius: 50%; display: flex;
            align-items: center; justify-content: center; color: #8A8580;
            transition: all 0.3s ease;
          }
          @media (max-width: 640px) {
            .back-btn { width: 36px; height: 36px; }
          }
          .back-btn:hover { background: rgba(138, 133, 128, 0.3); transform: scale(1.05); }
          .note-title { font-size: 20px; font-weight: 600; color: #2C2C2C; margin-left: 20px; }
          @media (max-width: 640px) {
            .note-title { font-size: 18px; margin-left: 12px; }
          }
          .note-content-area { flex: 1; padding: 32px; overflow-y: auto; }
          @media (max-width: 640px) {
            .note-content-area { padding: 16px; }
          }
          .note-book { font-size: 14px; color: #7C3AED; margin-bottom: 16px; }
          .note-text { font-size: 16px; line-height: 1.8; color: #4A4A4A; white-space: pre-wrap; }
          @media (max-width: 640px) {
            .note-text { font-size: 15px; line-height: 1.7; }
          }
          .note-tags { display: flex; gap: 8px; margin-top: 20px; flex-wrap: wrap; }
          .note-tag { padding: 4px 12px; background: rgba(124, 58, 237, 0.1);
            color: #7C3AED; border-radius: 16px; font-size: 13px; cursor: pointer; }
          .note-tag:hover { background: rgba(124, 58, 237, 0.2); }
          .note-actions { display: flex; gap: 12px; margin-top: 24px; }
          @media (max-width: 640px) {
            .note-actions { gap: 8px; }
          }
          .action-btn { padding: 8px 16px; border: none; border-radius: 8px;
            cursor: pointer; font-size: 14px; display: flex; align-items: center; gap: 6px; }
          @media (max-width: 640px) {
            .action-btn { padding: 6px 12px; font-size: 13px; }
          }
          .action-btn.delete { background: rgba(239, 68, 68, 0.1); color: #EF4444; }
          .action-btn.delete:hover { background: rgba(239, 68, 68, 0.2); }
          .action-btn.tag { background: rgba(124, 58, 237, 0.1); color: #7C3AED; }
          .action-btn.tag:hover { background: rgba(124, 58, 237, 0.2); }
          .discussion-section { margin-top: 32px; padding-top: 24px; border-top: 1px solid rgba(138, 133, 128, 0.1); }
          @media (max-width: 640px) {
            .discussion-section { margin-top: 20px; padding-top: 16px; }
          }
          .discussion-title { font-size: 16px; font-weight: 600; color: #2C2C2C; margin-bottom: 16px; }
          @media (max-width: 640px) {
            .discussion-title { font-size: 15px; margin-bottom: 12px; }
          }
          .discussion-list { display: flex; flex-direction: column; gap: 16px; }
          @media (max-width: 640px) {
            .discussion-list { gap: 12px; }
          }
          .discussion-item { background: white; padding: 16px; border-radius: 12px; }
          @media (max-width: 640px) {
            .discussion-item { padding: 12px; }
          }
          .discussion-user { font-weight: 500; color: #2C2C2C; margin-bottom: 8px; }
          .discussion-ai { color: #666; font-size: 14px; line-height: 1.6; }
          .discussion-input-area { display: flex; gap: 12px; margin-top: 16px; }
          @media (max-width: 640px) {
            .discussion-input-area { gap: 8px; }
          }
          .discussion-input { flex: 1; padding: 12px; border: 1px solid rgba(138, 133, 128, 0.3);
            border-radius: 8px; font-family: inherit; resize: none; }
          @media (max-width: 640px) {
            .discussion-input { padding: 10px; }
          }
          .discussion-send-btn { padding: 12px 24px; background: #7C3AED; color: white;
            border: none; border-radius: 8px; cursor: pointer; }
          @media (max-width: 640px) {
            .discussion-send-btn { padding: 10px 16px; }
          }
          .discussion-send-btn:disabled { opacity: 0.5; }
          .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,0.5); z-index: 1000000; display: flex;
            align-items: center; justify-content: center; }
          .modal-content { background: white; padding: 24px; border-radius: 16px;
            width: 90%; max-width: 500px; }
          .modal-title { font-size: 18px; font-weight: 600; margin-bottom: 16px; }
          .modal-input { width: 100%; padding: 12px; border: 1px solid #ddd;
            border-radius: 8px; margin-bottom: 12px; box-sizing: border-box; }
          .modal-actions { display: flex; justify-content: flex-end; gap: 12px; margin-top: 16px; }
          .modal-btn { padding: 8px 16px; border: none; border-radius: 8px; cursor: pointer; }
          .modal-btn.primary { background: #7C3AED; color: white; }
          .modal-btn.secondary { background: #eee; color: #333; }
        `}</style>
        <div className="sub-page-header">
          <button className="back-btn" onClick={handleBack}><ArrowLeftIcon size={20}/></button>
          <div className="note-title">笔记详情</div>
        </div>
        <div className="note-content-area">
          <div className="note-book"><BookIcon size={16}/> {note.book}</div>
          <div className="note-text">{note.content}</div>
          <div className="note-tags">
            {(note.tags || []).map(tag => (
              <div key={tag} className="note-tag" onClick={() => setActiveTag(tag)}>{tag}</div>
            ))}
          </div>
          <div className="note-actions">
            <button className="action-btn delete" onClick={() => deleteNote(note.id)}><TrashIcon size={16}/> 删除</button>
            <button className="action-btn tag" onClick={() => setShowTagModal(true)}><PlusIcon size={16}/> 添加标签</button>
          </div>
          <div className="discussion-section">
            <div className="discussion-title"><MessageIcon size={18}/> AI讨论</div>
            <div className="discussion-list">
              {(discussions[note.id] || []).map((d, idx) => (
                <div key={idx} className="discussion-item">
                  <div className="discussion-user">用户：{d.user}</div>
                  <div className="discussion-ai">AI：{d.ai}</div>
                </div>
              ))}
            </div>
            <div className="discussion-input-area">
              <textarea className="discussion-input" placeholder="和AI讨论这条笔记..."
                value={discussInput} onChange={(e) => setDiscussInput(e.target.value)}
                rows={3} disabled={discussLoading}/>
              <button className="discussion-send-btn" onClick={() => sendDiscussion(note.id)} disabled={discussLoading}>
                {discussLoading ? '发送中...' : '发送'}
              </button>
            </div>
          </div>
        </div>
        {showTagModal && (
          <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowTagModal(false)}>
            <div className="modal-content">
              <div className="modal-title">添加标签</div>
              <input className="modal-input" type="text" placeholder="输入标签名称..."
                value={newTagInput} onChange={(e) => setNewTagInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addTagToNote()}/>
              <div className="modal-actions">
                <button className="modal-btn secondary" onClick={() => setShowTagModal(false)}>取消</button>
                <button className="modal-btn primary" onClick={addTagToNote} disabled={!newTagInput.trim()}>添加</button>
              </div>
            </div>
          </div>
        )}
      </div>,
      document.body
    );
  }

  return createPortal(
    <div className="reading-notes-overlay">
      <style>{`
        .reading-notes-overlay {
          position: fixed; top: 0; left: 0; right: 0; bottom: 0;
          background: linear-gradient(135deg, #FAF7F2 0%, #F5F0E8 100%);
          z-index: 999999; display: flex; flex-direction: column;
          font-family: 'Noto Serif SC', serif;
        }
        .reading-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 12px 16px; flex-shrink: 0;
          flex-wrap: wrap; gap: 12px;
        }
        @media (max-width: 640px) {
          .reading-header {
            flex-direction: column;
            align-items: stretch;
            padding: 8px 12px;
            gap: 8px;
          }
        }
        .reading-close-btn {
          width: 44px; height: 44px; border: none;
          background: rgba(138, 133, 128, 0.15); font-size: 22px;
          cursor: pointer; border-radius: 50%; display: flex;
          align-items: center; justify-content: center; color: #8A8580;
          transition: all 0.3s ease;
        }
        .reading-close-btn:hover { background: rgba(138, 133, 128, 0.3); transform: scale(1.05); }
        .reading-title { font-size: 24px; font-weight: 700; color: #2C2C2C; }
        @media (max-width: 640px) {
          .reading-title { font-size: 20px; }
        }
        .header-actions { display: flex; gap: 8px; flex-wrap: wrap; }
        @media (max-width: 640px) {
          .header-actions { justify-content: flex-end; }
        }
        .header-btn { padding: 8px 12px; border: none; border-radius: 8px;
          cursor: pointer; font-size: 14px; display: flex; align-items: center; gap: 4px;
          background: rgba(124, 58, 237, 0.1); color: #7C3AED; }
        .header-btn:hover { background: rgba(124, 58, 237, 0.2); }
        @media (max-width: 640px) {
          .header-btn { padding: 6px 10px; font-size: 13px; }
        }
        .search-bar { padding: 12px 24px; background: rgba(255,255,255,0.8);
          border: 1px solid rgba(138, 133, 128, 0.2); border-radius: 24px;
          font-size: 14px; width: 300px; margin-left: 20px; }
        @media (max-width: 640px) {
          .search-bar { width: 100%; margin-left: 0; }
        }
        .filter-section { padding: 12px 16px; display: flex; gap: 12px;
          overflow-x: auto; flex-shrink: 0; border-bottom: 1px solid rgba(138, 133, 128, 0.1); }
        @media (max-width: 640px) {
          .filter-section { padding: 12px 12px; gap: 8px; }
        }
        .filter-label { font-size: 14px; color: #8A8580; white-space: nowrap; }
        .filter-chips { display: flex; gap: 8px; flex-wrap: wrap; }
        .filter-chip { padding: 6px 14px; background: white; border: 1px solid rgba(138, 133, 128, 0.2);
          border-radius: 16px; font-size: 13px; cursor: pointer; transition: all 0.2s; }
        .filter-chip:hover { border-color: #7C3AED; color: #7C3AED; }
        .filter-chip.active { background: #7C3AED; color: white; border-color: #7C3AED; }
        .notes-container { flex: 1; padding: 24px 32px; overflow-y: auto; }
        @media (max-width: 640px) {
          .notes-container { padding: 16px 12px; }
        }
        .book-section { margin-bottom: 32px; }
        @media (max-width: 640px) {
          .book-section { margin-bottom: 20px; }
        }
        .book-header { display: flex; align-items: center; gap: 8px; padding: 12px 16px;
          background: white; border-radius: 12px; cursor: pointer; margin-bottom: 16px; }
        .book-header:hover { background: rgba(255,255,255,0.8); }
        .book-name { font-size: 16px; font-weight: 600; color: #2C2C2C; }
        .book-count { font-size: 13px; color: #8A8580; }
        .notes-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 16px; }
        @media (max-width: 640px) {
          .notes-grid { grid-template-columns: 1fr; gap: 12px; }
        }
        .note-card { background: white; padding: 20px; border-radius: 12px;
          cursor: pointer; transition: all 0.3s ease; border: 1px solid transparent; }
        @media (max-width: 640px) {
          .note-card { padding: 16px; }
        }
        .note-card:hover { transform: translateY(-4px); box-shadow: 0 8px 24px rgba(0,0,0,0.08);
          border-color: rgba(124, 58, 237, 0.2); }
        .note-card-preview { font-size: 14px; color: #666; line-height: 1.6;
          display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden; }
        .note-card-footer { display: flex; justify-content: space-between; align-items: center;
          margin-top: 12px; }
        .note-card-tags { display: flex; gap: 4px; }
        .note-card-tag { padding: 2px 8px; background: rgba(124, 58, 237, 0.1);
          color: #7C3AED; border-radius: 8px; font-size: 12px; }
        .note-card-date { font-size: 12px; color: #aaa; }
        .empty-state { display: flex; flex-direction: column; align-items: center;
          justify-content: center; padding: 60px; color: #8A8580; }
        @media (max-width: 640px) {
          .empty-state { padding: 30px; }
        }
        .empty-icon { font-size: 48px; margin-bottom: 16px; }
        .empty-text { font-size: 16px; }
        .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0,0,0,0.5); z-index: 1000000; display: flex;
          align-items: center; justify-content: center; }
        .modal-content { background: white; padding: 24px; border-radius: 16px;
          width: 90%; max-width: 500px; max-height: 80vh; overflow-y: auto; }
        @media (max-width: 640px) {
          .modal-content { padding: 16px; width: 95%; }
        }
        .modal-title { font-size: 18px; font-weight: 600; margin-bottom: 16px; }
        @media (max-width: 640px) {
          .modal-title { font-size: 16px; }
        }
        .modal-input { width: 100%; padding: 12px; border: 1px solid #ddd;
          border-radius: 8px; margin-bottom: 12px; box-sizing: border-box; font-family: inherit; }
        .modal-textarea { width: 100%; padding: 12px; border: 1px solid #ddd;
          border-radius: 8px; margin-bottom: 12px; box-sizing: border-box;
          font-family: inherit; min-height: 120px; resize: vertical; }
        .modal-actions { display: flex; justify-content: flex-end; gap: 12px; margin-top: 16px; }
        .modal-btn { padding: 8px 16px; border: none; border-radius: 8px; cursor: pointer; }
        .modal-btn.primary { background: #7C3AED; color: white; }
        .modal-btn.secondary { background: #eee; color: #333; }
        .tag-suggestions { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }
        .tag-suggestion { padding: 4px 10px; background: #f5f5f5; border-radius: 12px;
          font-size: 12px; cursor: pointer; }
        .tag-suggestion:hover { background: rgba(124, 58, 237, 0.1); color: #7C3AED; }
        .selected-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }
        .selected-tag { padding: 4px 10px; background: rgba(124, 58, 237, 0.1);
          color: #7C3AED; border-radius: 12px; font-size: 12px; display: flex; align-items: center; gap: 4px; }
        .selected-tag span { cursor: pointer; }
      `}</style>
      <div className="reading-header">
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <h1 className="reading-title"><BookIcon size={28}/> 读书笔记</h1>
          <input className="search-bar" type="text" placeholder="搜索笔记..."
            value={searchQuery} onChange={(e) => handleSearch(e.target.value)}/>
        </div>
        <div className="header-actions">
          <button className="header-btn" onClick={() => setShowUploadModal(true)}><UploadIcon size={18}/> 导入</button>
          <button className="header-btn" onClick={() => setShowNewNoteModal(true)}><PlusIcon size={18}/> 新建笔记</button>
          <button className="header-btn" onClick={onToggleFloat}><FloatIcon size={18}/> 悬浮窗</button>
          <button className="reading-close-btn" onClick={onClose}>×</button>
        </div>
      </div>
      <div className="filter-section">
        <span className="filter-label">书籍：</span>
        <div className="filter-chips">
          <div className={`filter-chip ${selectedBook === null ? 'active' : ''}`} onClick={() => setSelectedBook(null)}>全部</div>
          {Object.keys(groupedNotes).map(book => (
            <div key={book} className={`filter-chip ${selectedBook === book ? 'active' : ''}`} onClick={() => handleBookSelect(book)}>
              {book}
            </div>
          ))}
        </div>
        <span className="filter-label" style={{ marginLeft: '20px' }}>标签：</span>
        <div className="filter-chips">
          <div className={`filter-chip ${activeTag === null ? 'active' : ''}`} onClick={() => setActiveTag(null)}>全部</div>
          {allTags.map(tag => (
            <div key={tag} className={`filter-chip ${activeTag === tag ? 'active' : ''}`} onClick={() => handleTagSelect(tag)}>
              {tag}
            </div>
          ))}
        </div>
      </div>
      <div className="notes-container">
        {isLoading ? (
          <div className="empty-state"><div className="empty-icon">📖</div><div className="empty-text">加载中...</div></div>
        ) : Object.keys(groupedNotes).length === 0 ? (
          <div className="empty-state"><div className="empty-icon">📚</div><div className="empty-text">暂无读书笔记，点击右上角新建</div></div>
        ) : (
          Object.keys(groupedNotes).map(book => (
            <div key={book} className="book-section">
              <div className="book-header" onClick={() => handleBookSelect(book)}>
                <BookIcon size={20}/>
                <span className="book-name">{book}</span>
                <span className="book-count">({groupedNotes[book].length}条)</span>
              </div>
              <div className="notes-grid">
                {groupedNotes[book].map(note => (
                  <div key={note.id} className="note-card" onClick={() => handleNoteSelect(note)}>
                    <div className="note-card-preview">{note.content}</div>
                    <div className="note-card-footer">
                      <div className="note-card-tags">
                        {(note.tags || []).slice(0, 3).map(tag => (
                          <span key={tag} className="note-card-tag">{tag}</span>
                        ))}
                      </div>
                      <span className="note-card-date">{new Date(note.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
      {showNewNoteModal && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowNewNoteModal(false)}>
          <div className="modal-content">
            <div className="modal-title">新建读书笔记</div>
            <input className="modal-input" type="text" placeholder="书籍名称"
              value={newNoteBook} onChange={(e) => setNewNoteBook(e.target.value)}/>
            <textarea className="modal-textarea" placeholder="写下你的笔记..."
              value={newNoteText} onChange={(e) => setNewNoteText(e.target.value)}/>
            <div className="tag-suggestions">
              {allTags.map(tag => (
                <span key={tag} className="tag-suggestion" onClick={() => handleAddTag(tag)}>{tag}</span>
              ))}
            </div>
            <div className="selected-tags">
              {newNoteTags.map(tag => (
                <span key={tag} className="selected-tag">{tag} <span onClick={() => removeTagFromNew(tag)}>×</span></span>
              ))}
            </div>
            <div className="modal-actions">
              <button className="modal-btn secondary" onClick={() => setShowNewNoteModal(false)}>取消</button>
              <button className="modal-btn primary" onClick={createNewNote} disabled={!newNoteText.trim() || !newNoteBook.trim()}>保存</button>
            </div>
          </div>
        </div>
      )}
      {showUploadModal && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowUploadModal(false)}>
          <div className="modal-content">
            <div className="modal-title">导入笔记</div>
            <div className="empty-text">暂支持从Markdown文件导入，开发中...</div>
            <div className="modal-actions">
              <button className="modal-btn secondary" onClick={() => setShowUploadModal(false)}>关闭</button>
            </div>
          </div>
        </div>
      )}

      {/* 阅读辅助悬浮窗 - 在最顶层渲染 */}
      <ReadingHelper
        onOpenReadingNotes={() => {}}
        isVisible={floatVisible}
        onVisibilityChange={onFloatVisibilityChange}
      />
    </div>,
    document.body
  );
}

export default ReadingNotesPage;