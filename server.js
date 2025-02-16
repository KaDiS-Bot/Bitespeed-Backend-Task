const express = require('express');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const app = express();
app.use(express.json());

app.post('/identify', async (req, res) => {
    try {
        const { email, phoneNumber } = req.body;

        if (!email && !phoneNumber) {
            return res.status(400).json({ error: 'Email or Phone Number is required' });
        }

        
        const existingContacts = await prisma.contact.findMany({
            where: {
                OR: [
                    { email: email || undefined },
                    { phoneNumber: phoneNumber || undefined }
                ]
            },
            orderBy: { createdAt: 'asc' }
        });

        let primaryContact;
        let secondaryContactIds = [];

        if (existingContacts.length > 0) {
       
            primaryContact = existingContacts.find(c => c.linkPrecedence === 'primary') || existingContacts[0];

           
            secondaryContactIds = existingContacts
                .filter(c => c.id !== primaryContact.id)
                .map(c => c.id);

           
            const isNewEmail = email && !existingContacts.some(c => c.email === email);
            const isNewPhone = phoneNumber && !existingContacts.some(c => c.phoneNumber === phoneNumber);

            if (isNewEmail || isNewPhone) {
                const newSecondary = await prisma.contact.create({
                    data: {
                        email: isNewEmail ? email : null,
                        phoneNumber: isNewPhone ? phoneNumber : null,
                        linkedId: primaryContact.id,
                        linkPrecedence: 'secondary'
                    }
                });
                secondaryContactIds.push(newSecondary.id);
            }
        } else {
    
            primaryContact = await prisma.contact.create({
                data: {
                    email,
                    phoneNumber,
                    linkPrecedence: 'primary'
                }
            });
        }

        
        const allLinkedContacts = await prisma.contact.findMany({
            where: {
                OR: [{ id: primaryContact.id }, { linkedId: primaryContact.id }]
            }
        });

        const emails = [...new Set(allLinkedContacts.map(c => c.email).filter(Boolean))];
        const phoneNumbers = [...new Set(allLinkedContacts.map(c => c.phoneNumber).filter(Boolean))];

        return res.json({
            contact: {
                primaryContactId: primaryContact.id,
                emails,
                phoneNumbers,
                secondaryContactIds
            }
        });
    } catch (error) {
        console.error('Error in /identify:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.listen(3000, () => {
    console.log('Server running on port 3000');
});
