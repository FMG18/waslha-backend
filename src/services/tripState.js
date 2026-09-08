const transitions = Object.freeze({
  searching: new Set(['driver_assigned', 'cancelled']),
  driver_assigned: new Set(['arriving', 'cancelled']),
  arriving: new Set(['in_progress', 'cancelled']),
  in_progress: new Set(['completed']),
  completed: new Set(),
  cancelled: new Set()
});

export function canTransition(from, to) {
  return transitions[from]?.has(to) ?? false;
}

export function allowedTransitions(status) {
  return [...(transitions[status] || [])];
}
