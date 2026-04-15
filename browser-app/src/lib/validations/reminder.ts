import { z } from 'zod'

export const reminderUpdateSchema = z.object({
  status: z.enum(['pending', 'contacted', 'done', 'snoozed']),
  due_date: z.string().optional().nullable(),
})

export type ReminderUpdateData = z.infer<typeof reminderUpdateSchema>
