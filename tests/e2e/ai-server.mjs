import { createServer } from 'node:http';
const question = { question: '2 + 2 = ?', section: 'Addition', type: 'Multiple Choice', difficulty: 'Easy', options: ['4', '3', '2', '1'], correct: '4', explanation: '2 + 2 = 4.' };
const metrics = Object.fromEntries(['conceptMastery', 'applicationSkill', 'problemDecomposition', 'logicalReasoning', 'errorAwareness', 'instructionFollowing'].map(key => [key, 100]));
createServer(async (request, response) => {
  if (request.method !== 'POST') { response.end('ready'); return; }
  const chunks = []; for await (const chunk of request) chunks.push(chunk);
  const body = JSON.parse(Buffer.concat(chunks).toString());
  const keys = body.response_format.json_schema.schema.properties;
  const prompt = body.messages.at(-1).content;
  const data = JSON.parse(prompt.slice(prompt.indexOf('{')));
  const vi = data.language === 'vi' || data.preferredLanguage === 'vi';
  const explanation = vi ? 'Cộng hai và hai được bốn.' : 'Adding two and two gives four.';
  let output;
  if (keys.questions) output = { questions: Array.from({ length: data.numQuestions || 1 }, () => ({ ...question, explanation, ...(data.type === 'Short Answer' ? { type: 'Short Answer', options: undefined } : {}) })) };
  else if (keys.cards) output = { cards: Array.from({ length: data.numCards || 1 }, () => ({ front: '2 + 2?', back: explanation })) };
  else if (keys.isValid) output = { isValid: true, reason: '' };
  else if (keys.isCorrect) output = { isCorrect: data.userAnswer === '4', feedback: explanation, confidence: 1 };
  else if (keys.aiResponse) output = { aiResponse: explanation };
  else output = { topicEn: 'Addition', topicVi: 'Phép cộng', en: { strengths: ['Addition'], weaknesses: [], recommendations: ['Practice daily'] }, vi: { strengths: ['Phép cộng'], weaknesses: [], recommendations: ['Luyện tập hằng ngày'] }, cognitiveMetrics: metrics, errorCategories: {} };
  response.setHeader('Content-Type', 'application/json');
  response.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(output) } }] }));
}).listen(9098, '127.0.0.1');
