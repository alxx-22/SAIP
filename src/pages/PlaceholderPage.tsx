import { Box, Text } from 'grommet';
import { Plan } from 'grommet-icons';
import { motion } from 'framer-motion';
import { fadeRise } from '@/motion/variants';
import { useAppMotion } from '@/motion/useAppMotion';

/**
 * Nav placeholder (brief §6, §10).
 *
 * Executive View and Business Development are navigation entries only. This
 * page exists so the nav links resolve to something honest rather than a blank
 * screen or a 404 — it states plainly that the page has not been built.
 */
export function PlaceholderPage({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  const { reduced } = useAppMotion();

  return (
    <Box pad="medium" align="center" justify="center" fill>
      <motion.div variants={fadeRise(reduced)} initial="hidden" animate="visible">
        <Box
          pad="large"
          round="medium"
          background="background-front"
          border={{ color: 'border-weak', style: 'dashed' }}
          align="center"
          gap="small"
          width="520px"
          margin={{ top: 'large' }}
        >
          <Plan size="large" color="icon-weak" />
          <Text as="h1" size="xlarge" weight={600} color="text-strong" margin="none">
            {title}
          </Text>
          <Text color="text-weak" textAlign="center">
            {description}
          </Text>
        </Box>
      </motion.div>
    </Box>
  );
}
