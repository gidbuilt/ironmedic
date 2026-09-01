import { createMachine } from './machines'

/** Sentinel nickname for machines created from quick-chat before Gus identifies equipment. */
export const QUICK_CHAT_PLACEHOLDER_NAME = 'New machine'

export async function createQuickChatMachine(userId: string) {
  return createMachine(userId, {
    name: QUICK_CHAT_PLACEHOLDER_NAME,
    make: '',
    model: '',
    serial_number: null,
    hours: null,
  })
}
