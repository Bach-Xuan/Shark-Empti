import { AI_IO_LIMITS } from './config/limits';
import type { AiCoachingChatbotInput } from './flows/ai-coaching-chatbot-flow';

const encoder = new TextEncoder();
const jsonBytes = (value: unknown) => encoder.encode(JSON.stringify(value)).length;

type History = NonNullable<AiCoachingChatbotInput['chatHistory']>;

/** Swap one intact exchange only when a single explicit quote identifies its source. */
function recallQuotedExchange(message: string, history: History, firstRecent: number, selected: History) {
  if (!firstRecent || !selected.length) return;
  const quotes = message.matchAll(/"([^"\n]+)"|“([^“”\n]+)”/g);
  const first = quotes.next().value;
  const quote = (first?.[1] ?? first?.[2])?.trim();
  if (!quote || !quotes.next().done || selected.some(turn => turn.message.includes(quote))) return;

  let match = -1;
  for (let index = firstRecent - 2; index >= 0; index -= 2) {
    if (history[index].message.includes(quote) || history[index + 1].message.includes(quote)) {
      if (match !== -1) return;
      match = index;
    }
  }
  if (match === -1) return;

  const pair = history.slice(match, match + 2);
  const cost = jsonBytes(pair);
  // Both pairs have the same delimiters. Keep the original quiz allocation and byte ceiling.
  for (let index = 0; index < selected.length; index += 2) {
    if (cost <= jsonBytes(selected.slice(index, index + 2))) {
      selected.splice(index, 2);
      selected.unshift(...pair);
      return;
    }
  }
}

/** Count the exact JSON sent to the generation endpoint, including array delimiters. */
export function fitCoachingContext(input: AiCoachingChatbotInput, recentStart = 0): AiCoachingChatbotInput | null {
  const quizQuestions: AiCoachingChatbotInput['quizQuestions'] = [];
  const chatHistory: NonNullable<AiCoachingChatbotInput['chatHistory']> = [];
  const result = { ...input, quizQuestions, chatHistory };
  let available = AI_IO_LIMITS.coachingInputBytes - jsonBytes(result);
  if (available < 0) return null;

  const history = input.chatHistory ?? [];
  let historyBudget = input.quizQuestions.length ? Math.floor(available / 2) : available;
  // The caller supplies only successful user/model exchanges in chronological order.
  let firstTurn = history.length;
  for (let index = history.length - 2; index >= recentStart; index -= 2) {
    const pair = history.slice(index, index + 2);
    const cost = jsonBytes(pair) - 2 + Number(firstTurn < history.length);
    if (cost > historyBudget) break;
    firstTurn = index;
    historyBudget -= cost;
    available -= cost;
  }

  chatHistory.push(...history.slice(firstTurn));
  recallQuotedExchange(input.userMessage, history, firstTurn, chatHistory);
  const priority = (question: AiCoachingChatbotInput['quizQuestions'][number]) => {
    if (question.questionText && input.userMessage.includes(question.questionText)) return 0;
    return question.isCorrect ? 2 : 1;
  };
  const ordered = input.quizQuestions.map((question, index) => ({ index, priority: priority(question) }))
    .sort((a, b) => a.priority - b.priority);
  const selected = new Set<number>();
  for (const { index } of ordered) {
    const cost = jsonBytes(input.quizQuestions[index]) + Number(selected.size > 0);
    if (cost <= available) { selected.add(index); available -= cost; }
  }
  quizQuestions.push(...input.quizQuestions.filter((_, index) => selected.has(index)));
  return result;
}
