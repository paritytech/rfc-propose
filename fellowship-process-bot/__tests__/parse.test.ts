import { expect, test } from '@jest/globals'
import parse from '../src/parse'

test('parse', () => {
  expect(parse('')).toMatchSnapshot()
  expect(parse('cmd')).toMatchSnapshot()
  expect(parse('/bot')).toMatchSnapshot()
  expect(parse('/bot cmd')).toMatchSnapshot()
  expect(parse('/bot cmd a b c')).toMatchSnapshot()
  expect(parse('/bot test val=123 val2=val2 val3')).toMatchSnapshot()

  const { getArg } = parse('/bot test some_value_1=1 SomeValue2=2 some-value-3=3 sOmev-al_uE4=4')
  expect(getArg('somevalue1')).toEqual('1')
  expect(getArg('some_value_2')).toEqual('2')
  expect(getArg('SomeValue3')).toEqual('3')
  expect(getArg('some-value-4')).toEqual('4')
})
