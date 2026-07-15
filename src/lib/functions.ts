import { getFunctions, httpsCallable } from "firebase/functions";
import app from "@/lib/firebase";

const functions = getFunctions(app, "asia-northeast3"); // 함수 배포 리전과 동일하게 맞춰주세요

export interface CreateClientAccountInput {
  email: string;
  password: string;
  name: string;
  clientId: string;
}

export interface CreateClientAccountResult {
  uid: string;
}

export async function createClientAccount(input: CreateClientAccountInput) {
  const fn = httpsCallable<CreateClientAccountInput, CreateClientAccountResult>(
    functions,
    "createClientAccount"
  );
  const res = await fn(input);
  return res.data;
}
