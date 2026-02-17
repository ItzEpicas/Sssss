import { z } from "zod";
import { STAFF_APPLICATION_POSITIONS } from "./types";

export const staffApplicationPositionSchema = z.enum(STAFF_APPLICATION_POSITIONS);

export const staffApplicationAnswersSchema = z
  .object({
    minecraftUsername: z.preprocess(
      (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
      z.string().trim().min(1).max(32).optional(),
    ),
    age: z.coerce.number().int().min(13).max(99),
    discordTag: z.string().trim().min(2).max(64),
    timezone: z.string().trim().min(1).max(64),
    serverPlaytime: z.string().trim().min(1).max(280),
    availability: z.string().trim().min(1).max(500),
    experience: z.string().trim().min(1).max(2000),
    motivation: z.string().trim().min(1).max(2000),
    additionalInfo: z.string().trim().max(1200).optional(),
    rulesAccepted: z.boolean().refine((v) => v === true, { message: "You must accept the rules." }),
  })
  .passthrough();

export const staffApplicationCreateSchema = z.object({
  position: staffApplicationPositionSchema,
  answers: staffApplicationAnswersSchema,
});

export const staffApplicationEditSchema = staffApplicationCreateSchema.extend({
  changeReason: z.string().trim().max(140).optional(),
});

export type StaffApplicationCreateInput = z.infer<typeof staffApplicationCreateSchema>;
export type StaffApplicationEditInput = z.infer<typeof staffApplicationEditSchema>;

// Useful for react-hook-form defaultValues, since form fields are often strings before coercion.
export type StaffApplicationCreateFormInput = z.input<typeof staffApplicationCreateSchema>;
export type StaffApplicationEditFormInput = z.input<typeof staffApplicationEditSchema>;
