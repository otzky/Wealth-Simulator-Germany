/** An environment setting, or undefined if it is empty or an unfilled placeholder such as "${user_config.x}". */
export function setting(v: string | undefined): string | undefined {
  const t = v?.trim();
  return t && !t.startsWith('${') ? t : undefined;
}
