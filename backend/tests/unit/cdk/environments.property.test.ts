// Feature: amazon-now-snap-backend-scaffold, Property 1: Environment config throws on any unrecognised env value
import fc from 'fast-check';
import { getEnvironmentConfig } from '../../../cdk/config/environments';

describe('getEnvironmentConfig', () => {
  it('Property 1: throws on any unrecognised env value', () => {
    fc.assert(
      fc.property(
        fc.string().filter((s) => !['dev', 'staging', 'prod'].includes(s)),
        (invalidEnv) => {
          expect(() => getEnvironmentConfig(invalidEnv)).toThrow();

          let thrownError: Error | undefined;
          try {
            getEnvironmentConfig(invalidEnv);
          } catch (e) {
            thrownError = e as Error;
          }

          expect(thrownError).toBeDefined();
          expect(thrownError?.message).toContain(invalidEnv);
          // Error message should contain at least one valid option
          const hasValidOption =
            thrownError?.message?.includes('dev') ||
            thrownError?.message?.includes('staging') ||
            thrownError?.message?.includes('prod');
          expect(hasValidOption).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('returns correct config for dev', () => {
    const config = getEnvironmentConfig('dev');
    expect(config.tablePrefix).toBe('Dev-');
    expect(config.stage).toBe('dev');
  });

  it('returns correct config for staging', () => {
    const config = getEnvironmentConfig('staging');
    expect(config.tablePrefix).toBe('Staging-');
    expect(config.stage).toBe('staging');
  });

  it('returns correct config for prod', () => {
    const config = getEnvironmentConfig('prod');
    expect(config.tablePrefix).toBe('');
    expect(config.stage).toBe('prod');
  });
});
