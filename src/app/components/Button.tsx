import React, { ButtonHTMLAttributes } from 'react';
import styles from './Button.module.css';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'danger' | 'secondary' | 'tertiary' | 'test';
  size?: 'small' | 'medium' | 'large';
}

const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'medium',
  className,
  ...props
}) => {
  const buttonClassName = `${styles.button} ${styles[variant]} ${styles[size]} ${className || ''}`;

  return (
    <button className={buttonClassName} {...props}>
      {children}
    </button>
  );
};

export default Button; 