import React, { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ClipboardList } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { staffApplicationEditSchema, type StaffApplicationEditFormInput } from "@/lib/staff-applications/schema";
import { STAFF_APPLICATION_POSITIONS } from "@/lib/staff-applications/types";
import { useLanguage } from "@/contexts/LanguageContext";
import { getPositionLabel } from "@/lib/staff-applications/ui";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  mode: "create" | "edit";
  defaultValues: StaffApplicationEditFormInput;
  submitting?: boolean;
  onSubmit: (values: StaffApplicationEditFormInput) => void | Promise<void>;
};

const StaffApplicationEditorDialog: React.FC<Props> = ({
  open,
  onOpenChange,
  title,
  description,
  mode,
  defaultValues,
  submitting,
  onSubmit,
}) => {
  const { language } = useLanguage();
  const isKa = language === "ka";

  const form = useForm<StaffApplicationEditFormInput>({
    resolver: zodResolver(staffApplicationEditSchema),
    defaultValues,
    mode: "onSubmit",
  });

  useEffect(() => {
    if (!open) return;
    form.reset(defaultValues);
  }, [defaultValues, form, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-card max-w-2xl border-border/40 p-0 shadow-2xl">
        <DialogHeader className="relative overflow-hidden border-b border-border/40 p-6 pb-5">
          <div className="absolute inset-0 gradient-radial opacity-30" />
          <div className="relative flex items-start gap-3">
            <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl gradient-primary text-primary-foreground shadow-lg">
              <ClipboardList className="h-5 w-5" />
            </div>
            <div className="space-y-1 text-left">
              <DialogTitle className="text-2xl font-display font-black tracking-tight">{title}</DialogTitle>
              {description ? <DialogDescription className="text-sm">{description}</DialogDescription> : null}
            </div>
          </div>
        </DialogHeader>

        <Form {...form}>
          <form
            className="max-h-[70vh] space-y-6 overflow-y-auto p-6"
            onSubmit={form.handleSubmit(async (values) => {
              await onSubmit(values);
            })}
          >
            <div className="space-y-4 rounded-2xl border border-border/40 bg-muted/10 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {isKa ? "ძირითადი ინფორმაცია" : "Basic info"}
              </p>

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="position"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{isKa ? "პოზიცია" : "Position"}</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger>
                          <SelectValue placeholder={isKa ? "აირჩიეთ პოზიცია" : "Select a position"} />
                        </SelectTrigger>
                        <SelectContent>
                          {STAFF_APPLICATION_POSITIONS.map((pos) => (
                            <SelectItem key={pos} value={pos}>
                              {getPositionLabel(pos, language)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="answers.minecraftUsername"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{isKa ? "Minecraft (არასავალდებულო)" : "Minecraft username (optional)"}</FormLabel>
                      <Input placeholder={isKa ? "თქვენი ნიკი" : "Your in-game name"} {...field} value={field.value ?? ""} />
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <FormField
                  control={form.control}
                  name="answers.age"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{isKa ? "ასაკი" : "Age"}</FormLabel>
                      <Input
                        type="number"
                        min={13}
                        max={99}
                        inputMode="numeric"
                        value={field.value === undefined ? "" : String(field.value)}
                        onChange={(event) => {
                          const raw = event.target.value;
                          field.onChange(raw === "" ? undefined : Number(raw));
                        }}
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="answers.timezone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{isKa ? "დროის ზონა" : "Timezone"}</FormLabel>
                      <Input placeholder={isKa ? "მაგ: UTC+4" : "e.g., UTC+4"} {...field} />
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="answers.discordTag"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Discord</FormLabel>
                      <Input placeholder={isKa ? "username ან user#1234" : "username or user#1234"} {...field} />
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className="space-y-4 rounded-2xl border border-border/40 bg-muted/10 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {isKa ? "დეტალები" : "Details"}
              </p>

              <FormField
                control={form.control}
                name="answers.serverPlaytime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{isKa ? "სერვერზე რამდენი ხანია თამაშობ?" : "Server playtime"}</FormLabel>
                    <Textarea
                      rows={2}
                      placeholder={isKa ? "მაგ: 2024 წლიდან, კვირაში ~10სთ" : "e.g., Since 2024, ~10h/week"}
                      {...field}
                      value={field.value ?? ""}
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="answers.availability"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{isKa ? "ხელმისაწვდომობა" : "Availability"}</FormLabel>
                    <Textarea
                      rows={3}
                      placeholder={isKa ? "როდის შეძლებთ თამაშს/მოდერაციას?" : "When can you play/moderate?"}
                      {...field}
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="answers.experience"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{isKa ? "გამოცდილება" : "Experience"}</FormLabel>
                    <Textarea
                      rows={4}
                      placeholder={isKa ? "მოგვიყევით მოდერაციის გამოცდილებაზე." : "Tell us about your moderation experience."}
                      {...field}
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="answers.motivation"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{isKa ? "რატომ გსურთ სტაფში შესვლა?" : "Why do you want to join the staff?"}</FormLabel>
                    <Textarea rows={4} placeholder={isKa ? "რა გაძლევთ მოტივაციას?" : "What motivates you?"} {...field} />
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="answers.additionalInfo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{isKa ? "დამატებითი ინფორმაცია (არასავალდებულო)" : "Additional info (optional)"}</FormLabel>
                    <Textarea
                      rows={3}
                      placeholder={isKa ? "კიდევ რამე გვინდა ვიცოდეთ?" : "Anything else we should know?"}
                      {...field}
                      value={field.value ?? ""}
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />

              {mode === "edit" ? (
                <FormField
                  control={form.control}
                  name="changeReason"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{isKa ? "ცვლილების მიზეზი (არასავალდებულო)" : "Change reason (optional)"}</FormLabel>
                      <Input placeholder={isKa ? "რა შეიცვალა?" : "What changed?"} {...field} value={field.value ?? ""} />
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ) : null}
            </div>

            <FormField
              control={form.control}
              name="answers.rulesAccepted"
              render={({ field }) => (
                <FormItem className="space-y-0 rounded-2xl border border-border/40 bg-muted/10 p-4">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      className="mt-1"
                      checked={field.value ?? false}
                      disabled={submitting}
                      onCheckedChange={(checked) => field.onChange(checked === true)}
                    />
                    <div className="space-y-1">
                      <FormLabel className="cursor-pointer">
                        {isKa
                          ? "ვადასტურებ, რომ წავიკითხე წესები და დავიცავ."
                          : "I confirm that I read the rules and will follow them."}
                      </FormLabel>
                      <a
                        href="/terms"
                        target="_blank"
                        rel="noreferrer"
                        className="block text-xs text-primary underline-offset-4 hover:underline"
                      >
                        {isKa ? "წესების ნახვა" : "View the rules"}
                      </a>
                      <p className="text-xs text-muted-foreground">
                        {isKa ? "გაგზავნამდე აუცილებელია მონიშვნა." : "Required to submit your application."}
                      </p>
                      <FormMessage />
                    </div>
                  </div>
                </FormItem>
              )}
            />

            <div className="flex items-center justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
                {isKa ? "გაუქმება" : "Cancel"}
              </Button>
              <Button type="submit" disabled={submitting}>
                {mode === "create" ? (isKa ? "გაგზავნა" : "Submit Application") : isKa ? "ხელახლა გაგზავნა" : "Resubmit Changes"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default StaffApplicationEditorDialog;
