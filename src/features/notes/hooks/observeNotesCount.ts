/** Dashboard count lifecycle, independently testable without rendering/navigation. */
export function observeNotesCount(
  service: Pick<
    ReturnType<typeof import('../services/notesService.ts').createNotesService>,
    'countActive' | 'subscribe'
  >,
  receive: (count: number) => void,
  fail: (error: unknown) => void,
) {
  let active = true;
  let generation = 0;
  const refresh = () => {
    const request = ++generation;
    void service
      .countActive()
      .then((count) => {
        if (active && request === generation) receive(count);
      })
      .catch((error) => {
        if (active && request === generation) fail(error);
      });
  };
  refresh();
  const unsubscribe = service.subscribe(refresh);
  return () => {
    active = false;
    unsubscribe();
  };
}
