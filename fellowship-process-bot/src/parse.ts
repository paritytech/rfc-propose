const parse = (body: string) => {
  const match = body.match(/\/bot\s+(\w+)(.*)/)
  if (!match) {
    return {
      getArg: () => undefined
    }
  }

  const [, cmd, args] = match

  // use csv parser to handle quoted strings
  const argsArr: string[] = args.trim().split(/\s+/)

  const namedArgs: Record<string, string> = {}
  const unnamedArgs: string[] = []

  const normalizedNamedArgs: Record<string, string> = {}

  const normalize = (key: string) => {
    return key.trim().toLowerCase().replaceAll('-', '').replaceAll('_', '')
  }

  for (const arg of argsArr) {
    if (arg.trim().length === 0) {
      continue
    }
    if (arg.includes('=')) {
      const [key, value] = arg.split('=')
      const trimmedValue = value.trim()
      namedArgs[key.trim()] = trimmedValue
      normalizedNamedArgs[normalize(key)] = trimmedValue
    } else {
      unnamedArgs.push(arg)
    }
  }

  return {
    cmd,
    namedArgs,
    unnamedArgs,
    rawArgs: args,
    getArg(key: string) {
      return normalizedNamedArgs[normalize(key)]
    }
  }
}

export default parse
