"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { SEED_STUDENTS } from "@/constants/seed-students";
import type { Student } from "@/types/student";

type StudentsContextValue = {
  students: Student[];
  recentSlugs: string[];
  addStudent: (s: Student) => void;
  updateStudent: (s: Student) => void;
  deleteStudent: (slug: string) => void;
  getStudent: (slug: string) => Student | undefined;
  findByEmail: (email: string) => Student | undefined;
  resetDemo: () => void;
};

const StudentsContext = createContext<StudentsContextValue | null>(null);

export function StudentsProvider({ children }: { children: React.ReactNode }) {
  const [students, setStudents] = useState<Student[]>(SEED_STUDENTS);
  const [recentSlugs, setRecentSlugs] = useState<string[]>([]);

  const addStudent = useCallback((s: Student) => {
    setStudents((prev) => [s, ...prev]);
    setRecentSlugs((prev) => [s.slug, ...prev].slice(0, 6));
  }, []);

  const updateStudent = useCallback((s: Student) => {
    setStudents((prev) => prev.map((x) => (x.slug === s.slug ? s : x)));
  }, []);

  const deleteStudent = useCallback((slug: string) => {
    setStudents((prev) => prev.filter((s) => s.slug !== slug));
    setRecentSlugs((prev) => prev.filter((x) => x !== slug));
  }, []);

  const resetDemo = useCallback(() => {
    setStudents(SEED_STUDENTS);
    setRecentSlugs([]);
  }, []);

  const value = useMemo<StudentsContextValue>(
    () => ({
      students,
      recentSlugs,
      addStudent,
      updateStudent,
      deleteStudent,
      getStudent: (slug) => students.find((s) => s.slug === slug),
      findByEmail: (email) =>
        students.find(
          (s) => (s.email || "").toLowerCase() === email.toLowerCase()
        ),
      resetDemo,
    }),
    [students, recentSlugs, addStudent, updateStudent, deleteStudent, resetDemo]
  );

  return <StudentsContext.Provider value={value}>{children}</StudentsContext.Provider>;
}

export function useStudents() {
  const ctx = useContext(StudentsContext);
  if (!ctx) throw new Error("useStudents must be used within StudentsProvider");
  return ctx;
}
