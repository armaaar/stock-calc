import { Option } from '@commander-js/extra-typings'

export const portfolioOption = new Option('-pt, --portfolio <type>', 'the portfolio to use').default('EUR')
