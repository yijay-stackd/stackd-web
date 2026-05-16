"use client";

import { createContext, useContext, useMemo, useState } from "react";
import { SEED_STUDENTS } from "@/constants/seed-students";
import type { Student } from "@/types/student";

type StudentsContextValue = {
  students: Student[];
  recentSlugs: string[];
  addStudent: (s: Student) => void;
  getStudent: (slug: string) => Student | undefined;
};

const StudentsContext = createContext<StudentsContextValue | null>(null);

export function StudentsProvider({ children }: { children: React.ReactNode }) {
  const [students, setStudents] = useState<Student[]>(SEED_STUDENTS);
  const [recentSlugs, setRecentSlugs] = useState<string[]>([]);

  const value = useMemo<StudentsContextValue>(
    () => ({
      students,
      recentSlugs,
      addStudent: (s) => {
        setStudents((prev) => [s, ...prev]);
        setRecentSlugs((prev) => [s.slug, ...prev].slice(0, 6));
      },
      getStudent: (slug) => students.find((s) => s.slug === slug),
    }),
    [students, recentSlugs]
  );

  return <StudentsContext.Provider value={value}>{children}</StudentsContext.Provider>;
}

export function useStudents() {
  const ctx = useContext(StudentsContext);
  if (!ctx) throw new Error("useStudents must be used within StudentsProvider");
  return ctx;
}
