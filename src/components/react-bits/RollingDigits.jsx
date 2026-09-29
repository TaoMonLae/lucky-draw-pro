import React, { useEffect } from 'react';
import { motion, useSpring, useTransform } from 'framer-motion';

// Based on React Bits Counter's spring-driven digit wheel:
// https://github.com/DavidHDev/react-bits/tree/main/src/content/Components/Counter
// Keep the raffle's leading zeroes and independently rolling digits.
function RollingNumber({ value, spring }) {
  const y = useTransform(spring, (latest) => {
    const placeValue = latest % 10;
    const offset = (10 + value - placeValue) % 10;
    return `${offset > 5 ? offset - 10 : offset}em`;
  });

  return <motion.span className="draw-console__wheel-number" style={{ y }}>{value}</motion.span>;
}

function RollingDigit({ value, place }) {
  const placeValue = Math.floor(value / place);
  const spring = useSpring(placeValue);

  useEffect(() => {
    spring.set(placeValue);
  }, [placeValue, spring]);

  return (
    <span className="draw-console__reel">
      {Array.from({ length: 10 }, (_, digit) => (
        <RollingNumber key={digit} value={digit} spring={spring} />
      ))}
    </span>
  );
}

export default function RollingDigits({ digits, reducedMotion, lockedDigits = '' }) {
  const value = Number(digits.join(''));
  return digits.map((digit, index) => reducedMotion || index < lockedDigits.length
    ? <span className="draw-console__reel draw-console__reel--static" key={index}>{index < lockedDigits.length ? lockedDigits[index] : digit}</span>
    : <RollingDigit key={index} value={value} place={10 ** (digits.length - index - 1)} />);
}
