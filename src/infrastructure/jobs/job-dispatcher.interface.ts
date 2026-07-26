export interface IJobDispatcher {
  dispatch<T = any>(jobName: string, payload: T): Promise<void>;
}

export const JOB_DISPATCHER = 'JOB_DISPATCHER';