/**
 * In-memory jobs store (UI-only, no backend yet). Seeds from the mock JOBS and
 * lets the Create screen add a new "queued" job that shows up in Jobs + its
 * detail screen. State is not persisted — a real backend/job-queue replaces this.
 */

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import { JOBS, type Job } from '@/mocks/data';

type NewJob = { title: string; seconds: number; tierLabel: string };

type JobsValue = {
  jobs: Job[];
  addJob: (input: NewJob) => string;
  getJob: (id: string) => Job | undefined;
};

const JobsContext = createContext<JobsValue | null>(null);

function scenesFor(seconds: number): number {
  return Math.max(1, Math.round(seconds / 10));
}

export function JobsProvider({ children }: { children: ReactNode }) {
  const [jobs, setJobs] = useState<Job[]>(JOBS);

  const addJob = useCallback((input: NewJob) => {
    const id = `j${Date.now()}`;
    const job: Job = {
      id,
      title: input.title,
      status: 'queued',
      scenesDone: 0,
      scenesTotal: scenesFor(input.seconds),
    };
    setJobs((prev) => [job, ...prev]);
    return id;
  }, []);

  const getJob = useCallback((id: string) => jobs.find((j) => j.id === id), [jobs]);

  const value = useMemo<JobsValue>(() => ({ jobs, addJob, getJob }), [jobs, addJob, getJob]);

  return <JobsContext.Provider value={value}>{children}</JobsContext.Provider>;
}

export function useJobs(): JobsValue {
  const ctx = useContext(JobsContext);
  if (!ctx) throw new Error('useJobs must be used within JobsProvider');
  return ctx;
}
