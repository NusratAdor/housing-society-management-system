// server/utils/transactionRetry.js
//
// Thin wrapper around Mongoose's session.withTransaction(), which
// already implements MongoDB's documented transaction retry
// semantics correctly — including the distinction between:
//   TransientTransactionError      → retry the WHOLE transaction body
//   UnknownTransactionCommitResult → retry ONLY the commit
// A hand-rolled retry loop cannot safely make this distinction (an
// unsafe earlier version of this file re-ran the whole callback for
// both cases, risking duplicate financial writes if a commit had
// actually succeeded but its response was lost). Don't reinvent this —
// the driver's built-in behavior is the correct, simpler answer.
//
// Usage:
//   await runInTransactionWithRetry(async (session) => {
//     ... all transactional work here, using { session } on every op ...
//     return someResult;
//   });

import mongoose from "mongoose";

export const runInTransactionWithRetry = async (work) => {
  const session = await mongoose.startSession();
  try {
    return await session.withTransaction(() => work(session));
  } finally {
    await session.endSession();
  }
};