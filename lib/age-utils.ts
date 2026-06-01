export function calculateAgeAtDate(birthDate: string | Date, referenceDate: string | Date): number {
  const birth = typeof birthDate === "string" ? new Date(birthDate) : birthDate;
  const ref = typeof referenceDate === "string" ? new Date(referenceDate) : referenceDate;
  if (isNaN(birth.getTime()) || isNaN(ref.getTime())) return 0;
  let age = ref.getFullYear() - birth.getFullYear();
  const hasBirthdayPassed =
    ref.getMonth() > birth.getMonth() ||
    (ref.getMonth() === birth.getMonth() && ref.getDate() >= birth.getDate());
  if (!hasBirthdayPassed) age--;
  return Math.max(0, age);
}

export function compareDeclaredAge({
  declaredAge,
  birthDate,
  checkInDate
}: {
  declaredAge: number;
  birthDate: string;
  checkInDate: string;
}): { declaredAge: number; calculatedAge: number; matches: boolean; difference: number } {
  const calculatedAge = calculateAgeAtDate(birthDate, checkInDate);
  const difference = calculatedAge - declaredAge;
  return { declaredAge, calculatedAge, matches: difference === 0, difference };
}
