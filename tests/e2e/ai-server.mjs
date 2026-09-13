import { createServer } from 'node:http';
const question = { question: '2 + 2 = ?', section: 'Addition', type: 'Multiple Choice', difficulty: 'Easy', options: ['4', '3', '2', '1'], correct: '4', explanation: '2 + 2 = 4.' };
const metrics = Object.fromEntries(['conceptMastery', 'applicationSkill', 'problemDecomposition', 'logicalReasoning', 'errorAwareness', 'instructionFollowing'].map(key => [key, 100]));
createServer(async (request, response) => {
  if (request.method !== 'POST') { response.end('ready'); return; }
  const chunks = []; for await (const chunk of request) chunks.push(chunk);
  try {
  const body = JSON.parse(Buffer.concat(chunks).toString());
  const prompt = body.messages.at(-1).content;
  const system = body.messages[0].content;
  const health = system.includes('service health check');
  const chat = system.includes('Requested language:') && system.includes('quizSummary');
  const data = health ? { ready: true } : chat ? { userMessage: prompt, preferredLanguage: system.includes('Requested language: vi') ? 'vi' : 'en' } : JSON.parse(prompt.slice(prompt.indexOf('{'), prompt.lastIndexOf('}') + 1));
  const vi = data.language === 'vi' || data.preferredLanguage === 'vi';
  const explanation = vi ? 'Cộng hai và hai được bốn.' : 'Adding two and two gives four.';
  let output;
  if (health) output = { ready: true };
  else if ('userMessage' in data) output = { aiResponse: explanation };
  else if ('userAnswer' in data) output = { isCorrect: data.userAnswer === '4', feedback: explanation, confidence: 1 };
  else if ('numCards' in data) output = { cards: Array.from({ length: data.numCards || 1 }, () => ({ front: '2 + 2?', back: explanation })) };
  else if ('concept' in data) output = { questions: Array.from({ length: data.numQuestions || 1 }, () => ({ ...question })) };
  else if ('type' in data) output = { questions: Array.from({ length: data.numQuestions || 1 }, () => ({ ...question, explanation, ...(data.type === 'Short Answer' ? { type: 'Short Answer', options: undefined } : {}) })) };
  else if ('quizResults' in data) output = { topicEn: 'Addition', topicVi: 'Phép cộng', en: { strengths: ['Addition'], weaknesses: [], recommendations: ['Practice daily'] }, vi: { strengths: ['Phép cộng'], weaknesses: [], recommendations: ['Luyện tập hằng ngày'] }, cognitiveMetrics: metrics, errorCategories: {} };
  else if ('topic' in data) output = { isValid: true, reason: '' };
  else output = { topicEn: 'Addition', topicVi: 'Phép cộng', en: { strengths: ['Addition'], weaknesses: [], recommendations: ['Practice daily'] }, vi: { strengths: ['Phép cộng'], weaknesses: [], recommendations: ['Luyện tập hằng ngày'] }, cognitiveMetrics: metrics, errorCategories: {} };
  response.setHeader('Content-Type', 'application/json');
  response.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(output) } }] }));
  } catch { response.statusCode = 400; response.end(JSON.stringify({ error: { message: 'Invalid fixture request' } })); }
}).listen(9098, '127.0.0.1');
