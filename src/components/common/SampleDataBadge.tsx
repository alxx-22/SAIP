import { Box, Text } from 'grommet';
import type { BoxProps } from 'grommet';
import { IS_USING_PLACEHOLDER_DATA } from '../../services';

/**
 * "Sample data" marker.
 *
 * Required by the build brief §5: anywhere a real figure, date or name will
 * eventually appear must be visually marked so a reviewer cannot mistake the
 * prototype for a live account. Rendered on every card, ribbon and table that
 * displays service-layer data.
 *
 * THE GATE IS HERE, NOT AT THE CALL SITES. Eighteen components render one of
 * these, and asking each of them to check the flag is asking for the one that
 * forgets — a live figure wearing a "sample data" badge, or worse, invented
 * data without one. Returning null from the component itself means the promise
 * this file has always made ("they all disappear at once") is actually kept by
 * a single line rather than by discipline.
 */
export function SampleDataBadge({
  label = 'Sample data',
  ...rest
}: { label?: string } & BoxProps) {
  if (!IS_USING_PLACEHOLDER_DATA) return null;

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
