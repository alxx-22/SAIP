import { Box, Text } from 'grommet';
import type { BoxProps } from 'grommet';

/**
 * "Sample data" marker.
 *
 * Required by the build brief §5: anywhere a real figure, date or name will
 * eventually appear must be visually marked so a reviewer cannot mistake the
 * prototype for a live account. Rendered on every card, ribbon and table that
 * displays service-layer data.
 *
 * When the Dataverse implementation is registered,
 * `IS_USING_PLACEHOLDER_DATA` flips to false and every one of these disappears
 * at once — there is no per-component cleanup to remember.
 */
export function SampleDataBadge({
  label = 'Sample data',
  ...rest
}: { label?: string } & BoxProps) {
  return (
    <Box
      as="span"
      direction="row"
      align="center"
      gap="xsmall"
      pad={{ horizontal: 'xsmall', vertical: '2px' }}
      round="xsmall"
      background="background-warning"
      border={{ color: 'border-weak', size: 'xsmall' }}
      flex={false}
      {...rest}
    >
      {/* Decorative dot — the text carries the meaning for screen readers. */}
      <Box
        width="6px"
        height="6px"
        round="full"
        background="foreground-warning"
        flex={false}
        aria-hidden
      />
      <Text size="xsmall" weight={500} color="text-strong">
        {label}
      </Text>
    </Box>
  );
}
