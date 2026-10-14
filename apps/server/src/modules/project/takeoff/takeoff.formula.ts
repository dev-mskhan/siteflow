import { Decimal } from 'decimal.js';
import { TakeoffFormulaError } from './takeoff.errors.js';

export const FORMULA_LIMITS = {
  maxLength: 500,
  maxDepth: 20,
  maxNodes: 200,
  maxVariables: 20,
} as const;

Decimal.set({ precision: 30, rounding: Decimal.ROUND_HALF_UP });

type Operator = '+' | '-' | '*' | '/';
type Token =
  | { kind: 'number'; value: string }
  | { kind: 'ident'; value: string }
  | { kind: 'op'; value: Operator | '(' | ')' | ',' };

type Node =
  | { kind: 'number'; value: Decimal }
  | { kind: 'variable'; name: string }
  | { kind: 'neg'; operand: Node }
  | { kind: 'binary'; op: Operator; left: Node; right: Node }
  | { kind: 'call'; fn: 'min' | 'max'; args: Node[] };

const FUNCTIONS = new Set(['min', 'max']);

function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < text.length) {
    const ch = text[i]!;
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    const rest = text.slice(i);
    const number = /^(?:\d+(?:\.\d+)?|\.\d+)/.exec(rest);
    if (number) {
      tokens.push({ kind: 'number', value: number[0] });
      i += number[0].length;
      continue;
    }
    const ident = /^[A-Za-z_][A-Za-z0-9_]*/.exec(rest);
    if (ident) {
      tokens.push({ kind: 'ident', value: ident[0] });
      i += ident[0].length;
      continue;
    }
    if ('+-*/(),'.includes(ch)) {
      tokens.push({ kind: 'op', value: ch as Operator | '(' | ')' | ',' });
      i++;
      continue;
    }
    throw new TakeoffFormulaError(`Unexpected character "${ch}" in formula.`);
  }
  return tokens;
}

class Parser {
  private pos = 0;
  private nodeCount = 0;

  constructor(
    private readonly tokens: Token[],
    private readonly variables: Set<string>,
  ) {}

  parse(): Node {
    const node = this.parseExpression(0);
    if (this.pos < this.tokens.length) {
      throw new TakeoffFormulaError('Unexpected token in formula.');
    }
    return node;
  }

  private enter(depth: number): void {
    this.nodeCount++;
    if (this.nodeCount > FORMULA_LIMITS.maxNodes) {
      throw new TakeoffFormulaError('Formula is too complex.');
    }
    if (depth > FORMULA_LIMITS.maxDepth) {
      throw new TakeoffFormulaError('Formula is nested too deeply.');
    }
  }

  private peekOp(): string | undefined {
    const token = this.tokens[this.pos];
    return token?.kind === 'op' ? token.value : undefined;
  }

  private parseExpression(depth: number): Node {
    this.enter(depth);
    let left = this.parseTerm(depth + 1);
    let op = this.peekOp();
    while (op === '+' || op === '-') {
      this.pos++;
      const right = this.parseTerm(depth + 1);
      left = { kind: 'binary', op, left, right };
      op = this.peekOp();
    }
    return left;
  }

  private parseTerm(depth: number): Node {
    this.enter(depth);
    let left = this.parseUnary(depth + 1);
    let op = this.peekOp();
    while (op === '*' || op === '/') {
      this.pos++;
      const right = this.parseUnary(depth + 1);
      left = { kind: 'binary', op, left, right };
      op = this.peekOp();
    }
    return left;
  }

  private parseUnary(depth: number): Node {
    this.enter(depth);
    const op = this.peekOp();
    if (op === '-') {
      this.pos++;
      return { kind: 'neg', operand: this.parseUnary(depth + 1) };
    }
    if (op === '+') {
      this.pos++;
      return this.parseUnary(depth + 1);
    }
    return this.parsePrimary(depth + 1);
  }

  private parsePrimary(depth: number): Node {
    this.enter(depth);
    const token = this.tokens[this.pos];
    if (!token) throw new TakeoffFormulaError('Formula ended unexpectedly.');

    if (token.kind === 'number') {
      this.pos++;
      return { kind: 'number', value: new Decimal(token.value) };
    }

    if (token.kind === 'ident') {
      this.pos++;
      if (this.peekOp() === '(') {
        const fn = token.value.toLowerCase();
        if (!FUNCTIONS.has(fn)) {
          throw new TakeoffFormulaError(`Unsupported function "${token.value}".`);
        }
        this.pos++;
        const args: Node[] = [this.parseExpression(depth + 1)];
        while (this.peekOp() === ',') {
          this.pos++;
          args.push(this.parseExpression(depth + 1));
        }
        if (this.peekOp() !== ')') throw new TakeoffFormulaError('Missing ")" in formula.');
        this.pos++;
        if (args.length < 2) {
          throw new TakeoffFormulaError(`${fn}() needs at least two arguments.`);
        }
        return { kind: 'call', fn: fn as 'min' | 'max', args };
      }
      if (!this.variables.has(token.value)) {
        throw new TakeoffFormulaError(`Unknown variable "${token.value}".`);
      }
      return { kind: 'variable', name: token.value };
    }

    if (this.peekOp() === '(') {
      this.pos++;
      const inner = this.parseExpression(depth + 1);
      if (this.peekOp() !== ')') throw new TakeoffFormulaError('Missing ")" in formula.');
      this.pos++;
      return inner;
    }

    throw new TakeoffFormulaError('Unexpected token in formula.');
  }
}

function evaluate(node: Node, values: Map<string, Decimal>): Decimal {
  switch (node.kind) {
    case 'number':
      return node.value;
    case 'variable':
      return values.get(node.name)!;
    case 'neg':
      return evaluate(node.operand, values).neg();
    case 'binary': {
      const left = evaluate(node.left, values);
      const right = evaluate(node.right, values);
      if (node.op === '+') return left.plus(right);
      if (node.op === '-') return left.minus(right);
      if (node.op === '*') return left.times(right);
      if (right.isZero()) throw new TakeoffFormulaError('Division by zero in formula.');
      return left.div(right);
    }
    case 'call': {
      const parts = node.args.map((arg) => evaluate(arg, values));
      return node.fn === 'min' ? Decimal.min(...parts) : Decimal.max(...parts);
    }
  }
}

export type FormulaInput = { variableName: string; value: string };

export function evaluateTakeoffFormula(formulaText: string, inputs: FormulaInput[]): Decimal {
  if (formulaText.length > FORMULA_LIMITS.maxLength) {
    throw new TakeoffFormulaError('Formula is too long.');
  }
  if (inputs.length > FORMULA_LIMITS.maxVariables) {
    throw new TakeoffFormulaError('Too many formula variables.');
  }
  const values = new Map<string, Decimal>();
  for (const input of inputs) {
    if (values.has(input.variableName)) {
      throw new TakeoffFormulaError(`Duplicate variable name: ${input.variableName}.`);
    }
    values.set(input.variableName, new Decimal(input.value));
  }
  const ast = new Parser(tokenize(formulaText), new Set(values.keys())).parse();
  const result = evaluate(ast, values);
  if (!result.isFinite()) throw new TakeoffFormulaError('Formula result is not a finite number.');
  return result;
}
