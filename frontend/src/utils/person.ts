type NamedPerson = { firstName: string; lastName: string };

// Demo/system accounts may carry only a display name in `firstName` (e.g.
// "Serwisant") with an empty `lastName`, so names are joined without
// leaving stray whitespace.
export function displayName(person: NamedPerson): string {
  return [person.firstName, person.lastName].map((part) => part.trim()).filter(Boolean).join(' ');
}
