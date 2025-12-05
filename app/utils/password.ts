// TODO: Add more robust validation
export const validate = (password: string): boolean =>{
    return (password.length >= 6);
}