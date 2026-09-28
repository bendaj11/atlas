export async function flushAsyncWork(rounds = 5) {
  for (let index = 0; index < rounds; index += 1)
    await new Promise((resolve) => setTimeout(resolve, 0));
}
