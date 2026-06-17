const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

let messages = [];

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now(), service: 'Chat API' });
});

app.get('/api/messages', (req, res) => {
  res.json({ success: true, data: messages });
});

app.post('/api/messages', (req, res) => {
  const { content, role = 'user' } = req.body;
  
  if (!content) {
    return res.status(400).json({ success: false, error: '内容不能为空' });
  }

  const newMessage = {
    id: Date.now(),
    content,
    role,
    time: new Date().toLocaleString('zh-CN')
  };

  messages.push(newMessage);

  setTimeout(() => {
    const replyMessage = {
      id: Date.now() + 1,
      content: getReply(content),
      role: 'assistant',
      time: new Date().toLocaleString('zh-CN')
    };
    messages.push(replyMessage);
  }, 1500);

  res.json({ success: true, data: newMessage });
});

app.delete('/api/messages/:id', (req, res) => {
  const messageId = parseInt(req.params.id);
  const index = messages.findIndex(msg => msg.id === messageId);
  
  if (index === -1) {
    return res.status(404).json({ success: false, error: '消息不存在' });
  }

  messages.splice(index, 1);
  res.json({ success: true, message: '删除成功' });
});

app.delete('/api/messages', (req, res) => {
  messages = [];
  res.json({ success: true, message: '清空成功' });
});

function getReply(message) {
  const replies = [
    '我理解你的想法，让我仔细思考一下...',
    '这是一个很好的观点呢！',
    '谢谢你的分享，我很感兴趣。',
    '让我来帮你分析一下这个问题。',
    '确实，生活中有很多值得我们去珍惜的小确幸。',
    '我觉得你说得很有道理，我们可以从不同角度来看看。',
    '这个话题很有意思，让我们深入探讨一下吧。',
    '嗯，我明白你的感受，有时候确实需要一些时间来理清思绪。',
    '好的，我明白了。让我整理一下思路。',
    '这让我想到了一些有趣的事情。',
    '你说得很对，这个问题值得我们好好讨论。',
    '我很乐意帮你解答这个问题。'
  ];
  return replies[Math.floor(Math.random() * replies.length)];
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});

module.exports = app;